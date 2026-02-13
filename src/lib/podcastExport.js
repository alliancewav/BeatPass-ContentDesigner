// ─── Podcast Video Export ───
// Uploads audio in ≤4 MB chunks to bypass Nginx body-size limits,
// then sends overlay PNG + metadata as a small JSON POST.
// Polls for ffmpeg render completion, returns the final MP4 URL.

const VIDEO_API_BASE = '/video-api';
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per chunk (Nginx limit ~6-8 MB)

function generateSessionId() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export async function exportPodcastVideo({
  audioFile,        // File object from drag-and-drop / file picker
  framePng,         // Full-frame PNG data URL (1920×1080, opaque — waveform dim)
  frameLitPng,      // Full-frame PNG data URL (1920×1080, opaque — waveform all lit)
  duration,         // audio duration in seconds
  width = 1920,
  height = 1080,
  progressBar = null, // {x, y, w, h} geometry of progress track
  timerInfo = null,   // {x, y, fontSize, color, opacity} for elapsed timer
  waveformRegion = null, // {x, y, w, h} geometry of waveform bars region
  accentColor = null, // theme accent hex for progress bar fill
  onProgress,
  onStatus,
  onJobId,          // callback to report jobId for cancellation
}) {
  if (!audioFile) throw new Error('No audio file provided');
  if (!framePng) throw new Error('No frame PNG provided');

  const sessionId = generateSessionId();
  const fileExt = '.' + (audioFile.name.split('.').pop() || 'm4a').toLowerCase();
  const totalChunks = Math.ceil(audioFile.size / CHUNK_SIZE);

  // ── Step 1: Upload audio in chunks ──
  if (onStatus) onStatus('Uploading audio...');
  if (onProgress) onProgress({ progress: 0 });

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, audioFile.size);
    const chunk = audioFile.slice(start, end);

    const res = await fetch(`${VIDEO_API_BASE}/podcast-upload-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-session-id': sessionId,
        'x-chunk-index': String(i),
        'x-total-chunks': String(totalChunks),
        'x-file-ext': fileExt,
      },
      body: chunk,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Chunk upload failed: ${res.status}`);
    }

    const uploadPct = (i + 1) / totalChunks * 0.4; // upload = 0-40% of total progress
    if (onProgress) onProgress({ progress: uploadPct });
    if (onStatus) onStatus(`Uploading audio... ${Math.round(uploadPct * 100)}%`);
  }

  // ── Step 2: Send overlay + metadata as JSON ──
  if (onStatus) onStatus('Sending overlay...');
  if (onProgress) onProgress({ progress: 0.42 });

  const exportRes = await fetch(`${VIDEO_API_BASE}/podcast-export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      framePng,
      frameLitPng: frameLitPng || null,
      duration: Math.round(duration),
      width,
      height,
      progressBar,
      timerInfo,
      waveformRegion,
      accentColor,
    }),
  });

  if (!exportRes.ok) {
    const err = await exportRes.json().catch(() => ({}));
    throw new Error(err.error || `Podcast export API error: ${exportRes.status}`);
  }

  const { jobId } = await exportRes.json();
  if (onJobId) onJobId(jobId);
  if (onProgress) onProgress({ progress: 0.45 });

  // ── Step 3: Poll for completion (timeout after 45 min) ──
  if (onStatus) onStatus('Rendering video...');
  const MAX_POLL_MS = 45 * 60 * 1000;
  const pollStart = Date.now();

  while (true) {
    await new Promise(r => setTimeout(r, 2000));

    if (Date.now() - pollStart > MAX_POLL_MS) {
      if (onStatus) onStatus('Timed out');
      throw new Error(`Podcast render timed out after 45 minutes (jobId: ${jobId})`);
    }

    const statusRes = await fetch(`${VIDEO_API_BASE}/status/${jobId}`);
    if (!statusRes.ok) throw new Error(`Failed to check job status (HTTP ${statusRes.status}, jobId: ${jobId})`);

    const status = await statusRes.json();

    // Map server progress (0-1) to our 45-100% range
    const renderPct = 0.45 + (status.progress || 0) * 0.55;
    if (onProgress) onProgress({ progress: renderPct });

    if (status.status === 'rendering') {
      if (onStatus) onStatus('Rendering video...');
    } else if (status.status === 'ready') {
      if (onStatus) onStatus('Done!');
      return { url: status.url, jobId };
    } else if (status.status === 'error') {
      throw new Error(status.error || 'Podcast video export failed on server');
    }
  }
}
