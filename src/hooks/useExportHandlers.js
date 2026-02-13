// ─── Export Handlers Hook ───
// Extracted from App.jsx — all export state + handlers for slides and stories.

import { useState, useRef, useCallback } from 'react';
import { captureElement, captureOverlayAsPng, captureElementAsBlob, downloadAllAsZip, downloadAllIndividual, isGifUrl, stripGhostImageTransforms } from '../lib/exportEngine';
import { exportSlideAsVideo, getVideoExtension, exportYouTubeVideo } from '../lib/videoExport';
import { exportPodcastVideo } from '../lib/podcastExport';

// ── Helpers ──

const waitForPaint = (ms = 600) => new Promise((r) => {
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, ms)));
});

const triggerDownload = (url, filename, shouldRevoke = false) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  if (shouldRevoke) URL.revokeObjectURL(url);
};

const getYtVideoId = (slide) => {
  const url = slide?.videoUrl || '';
  return url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1]
    || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1]
    || null;
};

const measureProgressBar = (overlayEl) => {
  const track = overlayEl?.querySelector('[data-progress-track]');
  if (!track) return null;
  const rootRect = overlayEl.getBoundingClientRect();
  const trackRect = track.getBoundingClientRect();
  return {
    x: Math.round(trackRect.left - rootRect.left),
    y: Math.round(trackRect.top - rootRect.top),
    w: Math.round(trackRect.width),
    h: Math.round(trackRect.height),
  };
};

const measureTimerLabel = (overlayEl) => {
  const el = overlayEl?.querySelector('[data-timer-elapsed]');
  if (!el) return null;
  const rootRect = overlayEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const parentStyle = window.getComputedStyle(el.parentElement);
  return {
    x: Math.round(elRect.left - rootRect.left),
    y: Math.round(elRect.top - rootRect.top),
    fontSize: Math.round(parseFloat(style.fontSize)),
    color: parentStyle.color,
    opacity: parseFloat(parentStyle.opacity),
  };
};

const measureWaveformRegion = (overlayEl) => {
  const el = overlayEl?.querySelector('[data-waveform-region]');
  if (!el) return null;
  const rootRect = overlayEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    x: Math.round(elRect.left - rootRect.left),
    y: Math.round(elRect.top - rootRect.top),
    w: Math.round(elRect.width),
    h: Math.round(elRect.height),
  };
};

// ── Hook ──

export default function useExportHandlers({
  slides,
  currentIndex,
  storyFrames,
  currentStoryIndex,
  editorTab,
  resolvedTheme,
  aspectRatio,
  exportContainerRef,
  overlayContainerRef,
  storyExportContainerRef,
  podcastOverlayContainerRef,
  podcastExportContainerRef,
  podcastExportLitRef,
  podcastAudioFile,
  podcastMeta,
  podcastAudioRef,
  podcastThumbnailRef,
}) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportIndex, setExportIndex] = useState(0);
  const [storyExportIndex, setStoryExportIndex] = useState(0);
  const [exportStatusMsg, setExportStatusMsg] = useState('');

  // Separate podcast export state (non-blocking)
  const [podcastExporting, setPodcastExporting] = useState(false);
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [podcastStatusMsg, setPodcastStatusMsg] = useState('');
  const [podcastJobId, setPodcastJobId] = useState(null);

  const slideWidth = 1080;
  const slideHeight = aspectRatio === 'portrait' ? 1350 : 1080;
  const storyWidth = 1080;
  const storyHeight = 1920;

  // ── GIF → MP4 helper ──
  const exportGifAsMp4 = async (slide, w, h) => {
    const overlayEl = overlayContainerRef.current;
    if (!overlayEl) throw new Error('Overlay container not ready');
    const overlayDataUrl = await captureOverlayAsPng(overlayEl, w, h);

    const rawGifUrl = stripGhostImageTransforms(slide.image);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    let res;
    try {
      res = await fetch('/video-api/gif-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gifUrl: rawGifUrl, overlayPng: overlayDataUrl, width: w, height: h, duration: 10 }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') throw new Error('GIF export timeout — server did not respond within 90s');
      throw err;
    }
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `GIF export API error: ${res.status}`);
    }
    const { url } = await res.json();
    return url;
  };

  // ── Slide Exports ──

  const handleExportSingle = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportIndex(currentIndex);
    setExportProgress({ current: 1, total: 1 });
    setExportStatusMsg('');
    try {
      const cs = slides[currentIndex];
      const ytId = getYtVideoId(cs);
      const isGif = cs?.imageSlide && isGifUrl(cs?.image);
      await waitForPaint();

      if (ytId) {
        const overlayEl = overlayContainerRef.current;
        if (!overlayEl) throw new Error('Overlay container not ready');
        const progressBar = measureProgressBar(overlayEl);
        const timerInfo = measureTimerLabel(overlayEl);
        const overlayDataUrl = await captureOverlayAsPng(overlayEl, slideWidth, slideHeight);

        setExportStatusMsg('Exporting video...');
        const videoUrl = await exportYouTubeVideo({
          videoId: ytId,
          overlayDataUrl,
          duration: 10,
          withAudio: false,
          width: slideWidth,
          height: slideHeight,
          progressBar,
          timerInfo,
          accentColor: resolvedTheme.accent,
          onProgress: ({ progress }) => setExportProgress({ current: Math.round(progress * 100), total: 100 }),
          onStatus: (msg) => setExportStatusMsg(msg),
        });

        triggerDownload(videoUrl, `slide-${String(currentIndex + 1).padStart(2, '0')}.mp4`);
      } else if (isGif) {
        setExportStatusMsg('Converting GIF to MP4...');
        const videoUrl = await exportGifAsMp4(cs, slideWidth, slideHeight);
        triggerDownload(videoUrl, `slide-${String(currentIndex + 1).padStart(2, '0')}.mp4`);
      } else {
        const el = exportContainerRef.current;
        if (!el) return;
        const dataUrl = await captureElement(el, slideWidth, slideHeight);
        triggerDownload(dataUrl, `slide-${String(currentIndex + 1).padStart(2, '0')}.png`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  }, [slides, currentIndex, slideWidth, slideHeight, resolvedTheme]);

  const handleExportAllZip = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportStatusMsg('');
    try {
      const renderAtIndex = async (i) => {
        setExportIndex(i);
        setExportProgress({ current: i + 1, total: slides.length });
        await waitForPaint();
        return exportContainerRef.current;
      };

      const ytVideoExportFn = async (slide, i) => {
        const ytId = getYtVideoId(slide);
        if (!ytId) throw new Error('No YouTube video ID');

        setExportIndex(i);
        await waitForPaint();
        const overlayEl = overlayContainerRef.current;
        if (!overlayEl) throw new Error('Overlay container not ready');
        const progressBar = measureProgressBar(overlayEl);
        const timerInfo = measureTimerLabel(overlayEl);
        const overlayDataUrl = await captureOverlayAsPng(overlayEl, slideWidth, slideHeight);

        setExportStatusMsg(`Exporting video slide ${i + 1}...`);
        const videoUrl = await exportYouTubeVideo({
          videoId: ytId,
          overlayDataUrl,
          duration: 60,
          withAudio: true,
          width: slideWidth,
          height: slideHeight,
          progressBar,
          timerInfo,
          accentColor: resolvedTheme.accent,
          onProgress: ({ progress }) => setExportProgress({ current: i + 1, total: slides.length }),
          onStatus: (msg) => setExportStatusMsg(`Slide ${i + 1}: ${msg}`),
        });

        const res = await fetch(videoUrl);
        if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
        return await res.blob();
      };

      const gifToMp4Fn = async (element, i, w, h) => {
        const slide = slides[i];
        const gifUrl = slide?.image;
        if (!gifUrl || !isGifUrl(gifUrl)) {
          setExportStatusMsg(`Converting slide ${i + 1} to MP4...`);
          const dataUrl = await captureElement(element, w, h);
          return await exportSlideAsVideo({ imageDataUrl: dataUrl, width: w, height: h, duration: 10, fps: 30 });
        }

        setExportIndex(i);
        await waitForPaint();
        setExportStatusMsg(`Converting GIF slide ${i + 1} to MP4...`);
        const videoUrl = await exportGifAsMp4(slide, w, h);
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error(`Failed to fetch GIF MP4: ${videoRes.status}`);
        return await videoRes.blob();
      };

      await downloadAllAsZip({
        renderSlideAtIndex: renderAtIndex,
        totalSlides: slides.length,
        width: slideWidth,
        height: slideHeight,
        slugName: 'carousel',
        slides,
        ytVideoExportFn,
        gifToMp4Fn,
      });
    } catch (err) {
      console.error('ZIP export failed:', err);
      alert('ZIP export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  }, [slides, slideWidth, slideHeight, resolvedTheme]);

  const handleExportAllPngs = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const renderAtIndex = async (i) => {
        setExportIndex(i);
        setExportProgress({ current: i + 1, total: slides.length });
        await waitForPaint();
        return exportContainerRef.current;
      };
      await downloadAllIndividual(renderAtIndex, slides.length, slideWidth, slideHeight);
    } finally {
      setExporting(false);
    }
  }, [slides, slideWidth, slideHeight]);

  const handleExportVideo = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportStatusMsg('');
    try {
      const cs = slides[currentIndex];
      const ytId = getYtVideoId(cs);
      const isGif = cs?.imageSlide && isGifUrl(cs?.image);
      setExportIndex(currentIndex);
      setExportProgress({ current: 1, total: 1 });
      await waitForPaint();

      if (ytId) {
        const overlayEl = overlayContainerRef.current;
        if (!overlayEl) throw new Error('Overlay container not ready');
        const progressBar = measureProgressBar(overlayEl);
        const timerInfo = measureTimerLabel(overlayEl);
        const overlayDataUrl = await captureOverlayAsPng(overlayEl, slideWidth, slideHeight);

        const videoUrl = await exportYouTubeVideo({
          videoId: ytId,
          overlayDataUrl,
          duration: 10,
          withAudio: false,
          width: slideWidth,
          height: slideHeight,
          progressBar,
          timerInfo,
          accentColor: resolvedTheme.accent,
          onProgress: ({ progress }) => setExportProgress({ current: Math.round(progress * 100), total: 100 }),
          onStatus: (msg) => setExportStatusMsg(msg),
        });

        triggerDownload(videoUrl, `slide-${String(currentIndex + 1).padStart(2, '0')}.mp4`);
      } else if (isGif) {
        setExportStatusMsg('Converting GIF to MP4...');
        const videoUrl = await exportGifAsMp4(cs, slideWidth, slideHeight);
        triggerDownload(videoUrl, `slide-${String(currentIndex + 1).padStart(2, '0')}.mp4`);
      } else {
        const el = exportContainerRef.current;
        if (!el) return;
        const dataUrl = await captureElement(el, slideWidth, slideHeight);
        const blob = await exportSlideAsVideo({
          imageDataUrl: dataUrl,
          width: slideWidth,
          height: slideHeight,
          duration: 10,
          fps: 30,
          onProgress: ({ progress }) => setExportProgress({ current: Math.round(progress * 100), total: 100 }),
        });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `slide-${String(currentIndex + 1).padStart(2, '0')}.${getVideoExtension()}`, true);
      }
    } catch (err) {
      console.error('Video export failed:', err);
      alert('Video export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  }, [slides, currentIndex, slideWidth, slideHeight, resolvedTheme]);

  const handleExportVideoWithAudio = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportStatusMsg('');
    try {
      const cs = slides[currentIndex];
      const ytId = getYtVideoId(cs);
      if (!ytId) throw new Error('No YouTube video on this slide');
      setExportIndex(currentIndex);
      setExportProgress({ current: 1, total: 1 });
      await waitForPaint();

      const overlayEl = overlayContainerRef.current;
      if (!overlayEl) throw new Error('Overlay container not ready');
      const progressBar = measureProgressBar(overlayEl);
      const timerInfo = measureTimerLabel(overlayEl);
      const overlayDataUrl = await captureOverlayAsPng(overlayEl, slideWidth, slideHeight);

      const videoUrl = await exportYouTubeVideo({
        videoId: ytId,
        overlayDataUrl,
        duration: 60,
        withAudio: true,
        width: slideWidth,
        height: slideHeight,
        progressBar,
        timerInfo,
        accentColor: resolvedTheme.accent,
        onProgress: ({ progress }) => setExportProgress({ current: Math.round(progress * 100), total: 100 }),
        onStatus: (msg) => setExportStatusMsg(msg),
      });

      triggerDownload(videoUrl, `slide-${String(currentIndex + 1).padStart(2, '0')}-audio.mp4`);
    } catch (err) {
      console.error('Video+audio export failed:', err);
      alert('Video export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  }, [slides, currentIndex, slideWidth, slideHeight, resolvedTheme]);

  // ── Story Exports ──

  const handleExportStory = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setStoryExportIndex(currentStoryIndex);
    setExportProgress({ current: 1, total: 1 });
    setExportStatusMsg('Rendering story...');
    try {
      await waitForPaint();
      const el = storyExportContainerRef.current;
      if (!el) throw new Error('Story export container not ready');
      const dataUrl = await captureElement(el, storyWidth, storyHeight);
      triggerDownload(dataUrl, `story-${String(currentStoryIndex + 1).padStart(2, '0')}.png`);
    } catch (err) {
      console.error('Story export failed:', err);
      alert('Story export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  }, [currentStoryIndex]);

  const handleExportAllStoriesZip = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportStatusMsg('');
    try {
      const renderAtIndex = async (i) => {
        setStoryExportIndex(i);
        setExportProgress({ current: i + 1, total: storyFrames.length });
        await waitForPaint();
        return storyExportContainerRef.current;
      };

      await downloadAllAsZip({
        renderSlideAtIndex: renderAtIndex,
        totalSlides: storyFrames.length,
        width: storyWidth,
        height: storyHeight,
        slugName: 'stories',
      });
    } catch (err) {
      console.error('Stories ZIP export failed:', err);
      alert('Stories ZIP export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  }, [storyFrames]);

  // ── Podcast Export (non-blocking — runs in background) ──

  const cancelPodcastExport = useCallback(() => {
    if (podcastJobId) {
      const blob = new Blob([JSON.stringify({ jobId: podcastJobId })], { type: 'application/json' });
      navigator.sendBeacon?.(`/video-api/podcast-cancel`, blob);
    }
    setPodcastExporting(false);
    setPodcastProgress(0);
    setPodcastStatusMsg('');
    setPodcastJobId(null);
  }, [podcastJobId]);

  const handleExportPodcast = useCallback(async () => {
    if (!podcastAudioFile) {
      alert('Please add an audio file first.');
      return;
    }
    if (podcastExporting) {
      alert('A podcast export is already in progress.');
      return;
    }
    setPodcastExporting(true);
    setExportMenuOpen(false);
    setPodcastStatusMsg('Preparing...');
    setPodcastProgress(0);
    // Pause preview audio during export
    if (podcastAudioRef?.current) { podcastAudioRef.current.pause(); }
    try {
      await waitForPaint();
      // Capture the FULL frame (background + cover art + colors + dim waveform bars)
      const frameEl = podcastExportContainerRef?.current;
      if (!frameEl) throw new Error('Podcast export container not ready');

      // Measure progress bar and timer positions from the export container
      // (timer text is visibility:hidden in export mode but still measurable)
      const progressBar = measureProgressBar(frameEl);
      const timerInfo = measureTimerLabel(frameEl);
      const waveformRegion = measureWaveformRegion(frameEl);
      // Capture dim frame (waveform at 0% — all bars unlit)
      const frameDataUrl = await captureElement(frameEl, 1920, 1080);

      // Capture lit frame (waveform at 100% — all bars highlighted)
      const litEl = podcastExportLitRef?.current;
      const frameLitDataUrl = litEl ? await captureElement(litEl, 1920, 1080) : null;

      const { url: videoUrl } = await exportPodcastVideo({
        audioFile: podcastAudioFile,
        framePng: frameDataUrl,
        frameLitPng: frameLitDataUrl,
        duration: podcastMeta?.audioDuration || 900,
        width: 1920,
        height: 1080,
        progressBar,
        timerInfo,
        waveformRegion,
        accentColor: resolvedTheme.accent,
        onProgress: ({ progress }) => setPodcastProgress(Math.round(progress * 100)),
        onStatus: (msg) => setPodcastStatusMsg(msg),
        onJobId: (id) => setPodcastJobId(id),
      });

      triggerDownload(videoUrl, `podcast-ep${podcastMeta?.episodeNumber || 1}.mp4`);
    } catch (err) {
      console.error('Podcast export failed:', err);
      if (err.message !== 'Podcast export cancelled') {
        alert('Podcast export failed: ' + err.message);
      }
    } finally {
      setPodcastExporting(false);
      setPodcastStatusMsg('');
      setPodcastProgress(0);
      setPodcastJobId(null);
    }
  }, [podcastAudioFile, podcastMeta, resolvedTheme, podcastExporting, podcastExportContainerRef, podcastExportLitRef, podcastAudioRef]);

  // ── Podcast Thumbnail Export ──

  const handleExportPodcastThumbnail = useCallback(async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportStatusMsg('Rendering thumbnail...');
    setExportProgress({ current: 1, total: 1 });
    try {
      await waitForPaint(400);
      const el = podcastThumbnailRef?.current;
      if (!el) throw new Error('Podcast thumbnail container not ready');
      const dataUrl = await captureElement(el, 1280, 720);
      triggerDownload(dataUrl, `podcast-ep${podcastMeta?.episodeNumber || 1}-thumbnail.png`);
    } catch (err) {
      console.error('Thumbnail export failed:', err);
      alert('Thumbnail export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  }, [podcastMeta]);

  return {
    // State
    exporting,
    exportProgress,
    exportMenuOpen,
    setExportMenuOpen,
    exportIndex,
    storyExportIndex,
    exportStatusMsg,
    // Podcast-specific state (non-blocking)
    podcastExporting,
    podcastProgress,
    podcastStatusMsg,
    podcastJobId,
    // Slide dimensions (needed by off-screen containers)
    slideWidth,
    slideHeight,
    storyWidth,
    storyHeight,
    // Slide export handlers
    handleExportSingle,
    handleExportAllZip,
    handleExportAllPngs,
    handleExportVideo,
    handleExportVideoWithAudio,
    // Story export handlers
    handleExportStory,
    handleExportAllStoriesZip,
    // Podcast export handler
    handleExportPodcast,
    cancelPodcastExport,
    handleExportPodcastThumbnail,
    // Helpers (re-exported for ExportDropdown)
    getYtVideoId,
    isCurrentGif: (slide) => slide?.imageSlide && isGifUrl(slide?.image),
    isCurrentYt: (slide) => !!getYtVideoId(slide),
  };
}

export { getYtVideoId };
