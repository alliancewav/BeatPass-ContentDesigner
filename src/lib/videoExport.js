// ─── Video Export Engine ───
// Converts a slide screenshot (PNG data URL) into a still-frame MP4 (no audio).
// Uses WebCodecs + mp4-muxer for H.264 MP4. Falls back to MediaRecorder WebM.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// Load an image from a data URL or blob URL
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const hasWebCodecs = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

// ── MP4 via WebCodecs + mp4-muxer ──
const encodeMP4 = async ({ drawFn, width, height, totalFrames, fps, onProgress }) => {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.640028', width, height,
    bitrate: 5_000_000, framerate: fps,
  });

  for (let f = 0; f < totalFrames; f++) {
    drawFn(ctx, f, totalFrames);

    const vf = new VideoFrame(canvas, {
      timestamp: (f / fps) * 1_000_000,
      duration: (1 / fps) * 1_000_000,
    });
    encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 });
    vf.close();

    if (onProgress && f % 10 === 0) onProgress({ progress: f / totalFrames });
    if (f % 30 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();
  if (onProgress) onProgress({ progress: 1 });
  return new Blob([target.buffer], { type: 'video/mp4' });
};

// ── Fallback: WebM via MediaRecorder ──
const encodeWebM = async ({ drawFn, width, height, totalFrames, fps, onProgress }) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9' : 'video/webm';
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  let f = 0;
  return new Promise((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    rec.onerror = reject;
    rec.start();
    const tick = () => {
      if (f >= totalFrames) { rec.stop(); return; }
      drawFn(ctx, f, totalFrames);
      f++;
      if (onProgress) onProgress({ progress: f / totalFrames });
      if (f < totalFrames) setTimeout(tick, 1000 / fps);
      else rec.stop();
    };
    tick();
  });
};

// ── Encode helper (auto-selects MP4 or WebM) ──
const encode = async (args) => {
  if (hasWebCodecs()) {
    try { return await encodeMP4(args); }
    catch (err) { console.warn('WebCodecs failed, falling back:', err); }
  }
  return encodeWebM(args);
};

// ────────────────────────────────────────────────
// PUBLIC: Still-frame video export (slide screenshot → silent MP4)
// ────────────────────────────────────────────────
export const exportSlideAsVideo = async ({
  imageDataUrl, width = 1080, height = 1350,
  duration = 10, fps = 30, onProgress,
}) => {
  const img = await loadImage(imageDataUrl);
  if (!img) throw new Error('Failed to load slide image for video export');
  const totalFrames = duration * fps;
  // Draw the image at 1:1 scale every frame — no Ken Burns, no animation
  const drawFn = (ctx) => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
  };
  return encode({ drawFn, width, height, totalFrames, fps, onProgress });
};

export const getVideoExtension = () => hasWebCodecs() ? 'mp4' : 'webm';

// ────────────────────────────────────────────────
// PUBLIC: YouTube video export via server-side yt-dlp + ffmpeg
// ────────────────────────────────────────────────
const VIDEO_API_BASE = '/video-api';

export async function exportYouTubeVideo({
  videoId,
  overlayDataUrl,
  duration = 10,
  withAudio = false,
  width = 1080,
  height = 1350,
  progressBar = null,
  timerInfo = null,
  accentColor = null,
  onProgress,
  onStatus,
}) {
  if (!videoId) throw new Error('No videoId provided');
  if (!overlayDataUrl) throw new Error('No overlay PNG provided');

  // 1. POST to video API to start the job
  if (onStatus) onStatus('Sending to server...');
  const body = { videoId, overlayPng: overlayDataUrl, duration, withAudio, width, height };
  if (progressBar) body.progressBar = progressBar;
  if (timerInfo) body.timerInfo = timerInfo;
  if (accentColor) body.accentColor = accentColor;
  const res = await fetch(`${VIDEO_API_BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Video API error: ${res.status}`);
  }

  const { jobId } = await res.json();

  // 2. Poll for completion
  const STATUS_MESSAGES = {
    downloading: 'Downloading YouTube video...',
    compositing: 'Compositing overlay...',
    ready: 'Done!',
  };

  while (true) {
    await new Promise(r => setTimeout(r, 2000));

    const statusRes = await fetch(`${VIDEO_API_BASE}/status/${jobId}`);
    if (!statusRes.ok) throw new Error('Failed to check job status');

    const status = await statusRes.json();

    if (onProgress) onProgress({ progress: status.progress || 0 });
    if (onStatus) onStatus(STATUS_MESSAGES[status.status] || status.status);

    if (status.status === 'ready') {
      // Return the same-origin URL to the final MP4
      return status.url;
    }

    if (status.status === 'error') {
      throw new Error(status.error || 'Video export failed on server');
    }
  }
}
