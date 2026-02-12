import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Plus,
  Trash2,
  Copy,
  Loader2,
  RotateCcw,
  Package,
  ChevronDown,
  Film,
} from 'lucide-react';

import PasswordGate from './components/PasswordGate';
import ArticleFetcher from './components/ArticleFetcher';
import SlideCanvas from './components/SlideCanvas';
import ThemePicker from './components/ThemePicker';
import ThumbnailStrip from './components/ThumbnailStrip';

import THEMES from './lib/themes';
import { getDominantColor, wcagTextColor, ensureContrast, darkenColor, lightenColor, hslToHex, rgbToHsl } from './lib/utils';
import { downloadAllAsZip, downloadAllIndividual, captureElement, captureOverlayAsPng } from './lib/exportEngine';
import { exportSlideAsVideo, getVideoExtension, exportYouTubeVideo } from './lib/videoExport';
import { fetchSettings } from './lib/ghostApi';
import { createBlankSlide, normaliseYouTubeUrl } from './lib/slideGenerator';
import CONFIG from './config';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState('input');

  // Slides state
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [article, setArticle] = useState(null);

  // Theme state
  const [activeThemeId, setActiveThemeId] = useState('aspectDark');
  const [dynamicTheme, setDynamicTheme] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('portrait');

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  // Index specifically for the export container (decoupled from preview)
  const [exportIndex, setExportIndex] = useState(0);

  // Refs
  const previewContainerRef = useRef(null);
  const exportContainerRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const [scale, setScale] = useState(0.3);
  const [exportStatusMsg, setExportStatusMsg] = useState('');

  // Image URLs — direct URLs, no base64 conversion (avoids CORS issues)
  const [imageCache, setImageCache] = useState({
    favicon: CONFIG.brand.favicon,
    logoWhite: CONFIG.brand.logoWhite,
    logoBlack: CONFIG.brand.logoBlack,
    cover: null,
  });

  // Resolve the active theme
  const resolvedTheme =
    activeThemeId === 'smartMatch' && dynamicTheme
      ? dynamicTheme
      : THEMES[activeThemeId] || THEMES.aspectDark;

  // ── Fetch Ghost settings on mount (for metadata only — logos are bundled locally) ──
  useEffect(() => {
    fetchSettings();
  }, []);

  // ── Resolve the best color-source image for an article ──
  // For video articles (#video/#video-preview): prefer YouTube thumbnail over edisc feature image
  // For regular articles: feature image > YouTube thumbnail from HTML > first slide video
  const resolveColorImage = (art, slideList) => {
    const tags = art?.tags?.map(t => typeof t === 'object' ? t.slug : t) || [];
    const isVideo = tags.includes('hash-video') || tags.includes('hash-video-preview');

    // Extract YouTube ID from article HTML
    const ytMatch = (art?.html || '').match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    const ytThumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` : null;

    // Video articles: prefer YouTube thumbnail (better color variety than edisc images)
    if (isVideo && ytThumb) return ytThumb;

    if (art?.featureImage) return art.featureImage;
    if (ytThumb) return ytThumb;
    // Fall back to first slide with a video URL
    for (const s of (slideList || [])) {
      const vid = (s.videoUrl || '').match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1]
        || (s.videoUrl || '').match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1];
      if (vid) return `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
    }
    return null;
  };

  // ── Memoize the resolved color-source image so effects only fire when the URL changes ──
  const resolvedColorImage = useMemo(
    () => resolveColorImage(article, slides),
    [article?.featureImage, article?.html, article?.tags, slides.map(s => s.videoUrl).join(',')]
  );

  // ── Update cover image when article changes ──
  useEffect(() => {
    const img = article?.featureImage || resolvedColorImage;
    if (img) setImageCache((prev) => ({ ...prev, cover: img }));
  }, [article?.featureImage, resolvedColorImage]);

  // ── WCAG-compliant dynamic theme from feature/video image ──
  // Uses HSL-based approach: extracts hue from dominant color, then builds
  // a professional dark palette that avoids muddy/ugly backgrounds.
  useEffect(() => {
    const imgSrc = resolvedColorImage;
    if (!imgSrc) return;
    (async () => {
      const raw = await getDominantColor(imgSrc);
      const hsl = rgbToHsl(raw.r, raw.g, raw.b);

      // Background: keep hue, cap saturation, force very dark (l ≈ 0.07–0.09)
      // This avoids muddy yellows/olives — always produces a rich, dark bg
      const bgSat = Math.min(hsl.s, 0.45);
      const bgHex = hslToHex(hsl.h, bgSat, 0.08);

      // Accent: same hue, boosted saturation, mid lightness for visibility
      const accentSat = Math.max(hsl.s, 0.55);
      const accentHex = hslToHex(hsl.h, accentSat, 0.58);

      // Text: always light — guaranteed WCAG AA on dark bg
      const textColor = '#E5E7EB';

      // Muted: desaturated tint of the hue
      const mutedHex = hslToHex(hsl.h, 0.15, 0.62);

      // Final WCAG checks
      const finalAccent = ensureContrast(bgHex, accentHex);
      const finalMuted = ensureContrast(bgHex, mutedHex, 3);
      const accentText = ensureContrast(finalAccent, '#0A0A0A');

      setDynamicTheme({
        ...THEMES.smartMatch,
        bg: bgHex,
        text: textColor,
        accent: finalAccent,
        accentBg: finalAccent,
        accentText,
        muted: finalMuted,
        gradient: `linear-gradient(180deg, ${bgHex}, ${hslToHex(hsl.h, bgSat, 0.04)})`,
        overlayGradient: () =>
          `linear-gradient(to top, ${bgHex} 15%, ${bgHex}E6 45%, transparent 100%)`,
        logoVariant: 'light',
        cardBg: 'rgba(255,255,255,0.06)',
      });
    })();
  }, [resolvedColorImage]);

  // ── Responsive scale ──
  useLayoutEffect(() => {
    const handleResize = () => {
      if (!previewContainerRef.current) return;
      const { width, height } = previewContainerRef.current.getBoundingClientRect();
      const slideW = 1080;
      const slideH = aspectRatio === 'portrait' ? 1350 : 1080;
      const pad = 80;
      const scaleX = Math.max(0, width - pad) / slideW;
      const scaleY = Math.max(0, height - pad) / slideH;
      setScale(Math.min(scaleX, scaleY, 0.5));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mode, aspectRatio]);

  // ── Handlers ──
  const handleSlidesGenerated = useCallback((newSlides, newArticle) => {
    setSlides(newSlides);
    setArticle(newArticle);
    setCurrentIndex(0);
    setMode('editor');
  }, []);

  const handleReset = () => {
    setMode('input');
    setSlides([]);
    setArticle(null);
    setCurrentIndex(0);
  };

  const updateSlideField = (id, field, value) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addSlideAfter = () => {
    const contentCount = slides.filter((s) => s.type === 'content').length;
    const newSlide = createBlankSlide('content', contentCount + 1);
    const newSlides = [...slides];
    newSlides.splice(currentIndex + 1, 0, newSlide);
    setSlides(newSlides);
    setCurrentIndex(currentIndex + 1);
  };

  const deleteCurrentSlide = () => {
    if (slides.length <= 2) return;
    const newSlides = slides.filter((_, i) => i !== currentIndex);
    let num = 0;
    newSlides.forEach((s) => {
      if (s.type === 'content') { num++; s.number = num; }
    });
    setSlides(newSlides);
    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  const duplicateCurrentSlide = () => {
    const src = slides[currentIndex];
    const dupe = { ...src, id: `slide-dup-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` };
    const newSlides = [...slides];
    newSlides.splice(currentIndex + 1, 0, dupe);
    let num = 0;
    newSlides.forEach((s) => {
      if (s.type === 'content') { num++; s.number = num; }
    });
    setSlides(newSlides);
    setCurrentIndex(currentIndex + 1);
  };

  // ── Export ──
  const slideWidth = 1080;
  const slideHeight = aspectRatio === 'portrait' ? 1350 : 1080;

  const waitForPaint = (ms = 600) => new Promise((r) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, ms)));
  });

  const handleExportSingle = async () => {
    setExporting(true);
    setExportIndex(currentIndex);
    setExportProgress({ current: 1, total: 1 });
    try {
      await waitForPaint();
      const el = exportContainerRef.current;
      if (!el) return;
      const dataUrl = await captureElement(el, slideWidth, slideHeight);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `slide-${String(currentIndex + 1).padStart(2, '0')}.png`;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const handleExportAllZip = async () => {
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

      // YouTube video export callback for ZIP: captures overlay, calls server API, returns blob
      const ytVideoExportFn = async (slide, i) => {
        const ytId = getYtVideoId(slide);
        if (!ytId) throw new Error('No YouTube video ID');

        // Render overlay for this slide
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

        // Fetch the server-generated MP4 as a blob for the ZIP
        const res = await fetch(videoUrl);
        if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
        return await res.blob();
      };

      await downloadAllAsZip(renderAtIndex, slides.length, slideWidth, slideHeight, article?.slug || 'carousel', slides, null, ytVideoExportFn);
    } catch (err) {
      console.error('ZIP export failed:', err);
      alert('ZIP export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  };

  const handleExportAllPngs = async () => {
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
  };

  // Helper: measure progress bar track position from overlay container for ffmpeg animation
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

  // Helper: measure elapsed timer label position for ffmpeg drawtext animation
  const measureTimerLabel = (overlayEl) => {
    const el = overlayEl?.querySelector('[data-timer-elapsed]');
    if (!el) return null;
    const rootRect = overlayEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Get computed style for font size and color
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

  // Helper: extract YouTube video ID from a slide
  const getYtVideoId = (slide) => {
    const url = slide?.videoUrl || '';
    return url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1]
      || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1]
      || null;
  };

  // Export video (muted, 10s) — uses server-side yt-dlp for YouTube slides
  const handleExportVideo = async () => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportStatusMsg('');
    try {
      const cs = slides[currentIndex];
      const ytId = getYtVideoId(cs);
      setExportIndex(currentIndex);
      setExportProgress({ current: 1, total: 1 });
      await waitForPaint();

      if (ytId) {
        // YouTube slide → server-side yt-dlp + ffmpeg composite
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

        // Download the server-generated MP4
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `slide-${String(currentIndex + 1).padStart(2, '0')}.mp4`;
        link.click();
      } else {
        // Non-YouTube slide → client-side still-frame MP4
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
        const link = document.createElement('a');
        link.href = url;
        link.download = `slide-${String(currentIndex + 1).padStart(2, '0')}.${getVideoExtension()}`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Video export failed:', err);
      alert('Video export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  };

  // Export video with audio (60s) — YouTube only
  const handleExportVideoWithAudio = async () => {
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

      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `slide-${String(currentIndex + 1).padStart(2, '0')}-audio.mp4`;
      link.click();
    } catch (err) {
      console.error('Video+audio export failed:', err);
      alert('Video export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportStatusMsg('');
    }
  };

  // ── Auth gate ──
  if (!authenticated) {
    return <PasswordGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  // ── Input mode ──
  if (mode === 'input') {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col">
        <Header imageCache={imageCache} />
        <ArticleFetcher onSlidesGenerated={handleSlidesGenerated} />
      </div>
    );
  }

  // ── Editor mode ──
  const currentSlide = slides[currentIndex];

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-none h-14 border-b border-white/[0.06] flex items-center justify-between px-4 z-30 bg-neutral-950">
        <div className="flex items-center gap-3">
          <img src={imageCache.favicon} className="w-6 h-6 rounded" alt="" />
          <span className="text-sm font-semibold text-white/70 hidden sm:inline">Content Designer</span>
          <span className="text-white/20 hidden sm:inline">·</span>
          <span className="text-xs text-white/30 truncate max-w-[200px] hidden sm:inline">{article?.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white/80 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-all flex items-center gap-1.5">
            <RotateCcw size={13} /> New
          </button>
          <div className="relative">
            <button onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={exporting} className="px-4 py-1.5 text-xs font-semibold bg-white text-neutral-950 rounded-lg hover:bg-white/90 transition-all flex items-center gap-1.5 disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export <ChevronDown size={12} />
            </button>
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-neutral-900 border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <button onClick={handleExportSingle} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5">
                    <Download size={14} className="text-white/40" />
                    <div><div className="font-medium text-white/80">Current Slide</div><div className="text-white/30 text-[10px]">Download as PNG</div></div>
                  </button>
                  <button onClick={handleExportAllZip} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
                    <Package size={14} className="text-white/40" />
                    <div><div className="font-medium text-white/80">All Slides (ZIP)</div><div className="text-white/30 text-[10px]">Bundle as .zip archive</div></div>
                  </button>
                  <button onClick={handleExportAllPngs} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
                    <Download size={14} className="text-white/40" />
                    <div><div className="font-medium text-white/80">All Slides (PNGs)</div><div className="text-white/30 text-[10px]">Individual file downloads</div></div>
                  </button>
                  {currentSlide?.videoUrl && (
                    <>
                      <button onClick={handleExportVideo} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
                        <Film size={14} className="text-white/40" />
                        <div><div className="font-medium text-white/80">Video (Muted)</div><div className="text-white/30 text-[10px]">10s MP4, no audio</div></div>
                      </button>
                      <button onClick={handleExportVideoWithAudio} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
                        <Film size={14} className="text-violet-400/70" />
                        <div><div className="font-medium text-white/80">Video + Audio</div><div className="text-white/30 text-[10px]">60s MP4 with YouTube audio</div></div>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Sidebar ── */}
        <div className="flex-none w-72 border-r border-white/[0.06] flex flex-col bg-neutral-950/80 overflow-y-auto">
          <div className="p-4 space-y-5 border-b border-white/[0.06]">
            <ThemePicker activeThemeId={activeThemeId} onThemeChange={setActiveThemeId} dynamicPreview={dynamicTheme} />
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Aspect Ratio</label>
              <div className="flex bg-white/[0.04] p-1 rounded-lg">
                <button onClick={() => setAspectRatio('square')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${aspectRatio === 'square' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>1:1</button>
                <button onClick={() => setAspectRatio('portrait')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${aspectRatio === 'portrait' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>4:5</button>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Slide {currentIndex + 1} of {slides.length}</span>
              <div className="flex gap-1">
                <button onClick={addSlideAfter} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Add slide after"><Plus size={14} /></button>
                <button onClick={duplicateCurrentSlide} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Duplicate slide"><Copy size={14} /></button>
                <button onClick={deleteCurrentSlide} disabled={slides.length <= 2} className="p-1.5 rounded-md hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-20" title="Delete slide"><Trash2 size={14} /></button>
              </div>
            </div>
            {currentSlide && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Title</label>
                  <input type="text" value={currentSlide.title || ''} onChange={(e) => updateSlideField(currentSlide.id, 'title', e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                </div>
                {currentSlide.type === 'content' && (
                  <>
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Content</label>
                      <textarea value={currentSlide.content || ''} onChange={(e) => updateSlideField(currentSlide.id, 'content', e.target.value)} rows={4} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                      <div className="text-[10px] text-white/20 mt-1 text-right">{(currentSlide.content || '').length} / 200 chars</div>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center gap-2">
                        Image Slide
                        <button
                          onClick={() => updateSlideField(currentSlide.id, 'imageSlide', !currentSlide.imageSlide)}
                          className={`w-8 h-4 rounded-full transition-colors ${currentSlide.imageSlide ? 'bg-violet-500' : 'bg-white/10'}`}
                        >
                          <div className={`w-3 h-3 rounded-full bg-white transition-transform ${currentSlide.imageSlide ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                      {currentSlide.imageSlide && (
                        <>
                          <input type="text" value={currentSlide.image || ''} onChange={(e) => updateSlideField(currentSlide.id, 'image', e.target.value || null)} placeholder="Image URL (full-bleed bg)" className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                          {currentSlide.image && (
                            <div className="mt-1.5 rounded-md overflow-hidden border border-white/[0.06]" style={{ height: 48 }}>
                              <img src={currentSlide.image} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Video URL <span className="text-white/15 normal-case">(YouTube or mp4)</span></label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={currentSlide.videoUrl || ''}
                          onChange={(e) => {
                            const raw = e.target.value || null;
                            if (raw) {
                              const norm = normaliseYouTubeUrl(raw);
                              updateSlideField(currentSlide.id, 'videoUrl', norm);
                              // Auto-set YouTube thumbnail as image + mark as image slide
                              const ytMatch = norm.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                              if (ytMatch) {
                                updateSlideField(currentSlide.id, 'image', `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`);
                                updateSlideField(currentSlide.id, 'imageSlide', true);
                              }
                            } else {
                              updateSlideField(currentSlide.id, 'videoUrl', null);
                            }
                          }}
                          placeholder="https://youtu.be/... or https://...video.mp4"
                          className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15"
                        />
                        {currentSlide.videoUrl && (
                          <button onClick={() => { updateSlideField(currentSlide.id, 'videoUrl', null); }} className="px-2 py-1 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Remove video">✕</button>
                        )}
                      </div>
                      {currentSlide.videoUrl && /youtube|youtu\.be/i.test(currentSlide.videoUrl) && (
                        <div className="text-[10px] text-violet-400/60 mt-1">YouTube video detected — thumbnail auto-set</div>
                      )}
                    </div>
                  </>
                )}
                {(currentSlide.type === 'cover' || currentSlide.type === 'cta') && currentSlide.subtitle !== undefined && (
                  <div>
                    <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Subtitle / Tag</label>
                    <input type="text" value={currentSlide.subtitle || ''} onChange={(e) => updateSlideField(currentSlide.id, 'subtitle', e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                  </div>
                )}
                {currentSlide.type === 'cover' && (
                  <div>
                    <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Reading Time</label>
                    <input type="text" value={currentSlide.readingTime || ''} onChange={(e) => updateSlideField(currentSlide.id, 'readingTime', e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Center Preview ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={previewContainerRef} className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="flex items-center gap-4 z-10 relative">
              <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="p-3 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 disabled:opacity-20 hover:bg-white/[0.1] transition-all"><ArrowLeft size={18} /></button>
              <div className="relative slide-shadow rounded-sm" style={{ width: 1080 * scale, height: slideHeight * scale }}>
                <div className="absolute top-0 left-0 origin-top-left" style={{ width: 1080, height: slideHeight, transform: `scale(${scale})` }}>
                  <SlideCanvas slide={currentSlide} index={currentIndex} totalSlides={slides.length} theme={resolvedTheme} aspectRatio={aspectRatio} imageCache={imageCache} />
                </div>
                <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity z-20">
                  <button onClick={handleExportSingle} disabled={exporting} className="p-2 bg-black/70 text-white rounded-lg hover:bg-black backdrop-blur-sm border border-white/10" title="Download this slide"><Download size={16} /></button>
                </div>
              </div>
              <button onClick={() => setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))} disabled={currentIndex === slides.length - 1} className="p-3 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 disabled:opacity-20 hover:bg-white/[0.1] transition-all"><ArrowRight size={18} /></button>
            </div>
          </div>
          <div className="flex-none border-t border-white/[0.06] bg-neutral-950/80 px-4 py-2">
            <ThumbnailStrip slides={slides} currentIndex={currentIndex} onSelect={setCurrentIndex} theme={resolvedTheme} aspectRatio={aspectRatio} imageCache={imageCache} />
          </div>
        </div>
      </div>

      {/* ── ALWAYS-RENDERED export container ──
           Off-screen — html-to-image clones the DOM so visibility isn't needed. */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: slideWidth,
          height: slideHeight,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div ref={exportContainerRef} style={{ width: slideWidth, height: slideHeight }}>
          {slides.length > 0 && (
            <SlideCanvas
              slide={slides[exporting ? exportIndex : currentIndex]}
              index={exporting ? exportIndex : currentIndex}
              totalSlides={slides.length}
              theme={resolvedTheme}
              aspectRatio={aspectRatio}
              imageCache={imageCache}
              isExport={true}
            />
          )}
        </div>
      </div>

      {/* ── Off-screen overlay-only container (transparent background for video composite) ── */}
      <div
        style={{
          position: 'fixed', top: -9999, left: -9999,
          width: slideWidth, height: slideHeight,
          overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
        }}
      >
        <div ref={overlayContainerRef} style={{ width: slideWidth, height: slideHeight }}>
          {slides.length > 0 && (
            <SlideCanvas
              slide={slides[exporting ? exportIndex : currentIndex]}
              index={exporting ? exportIndex : currentIndex}
              totalSlides={slides.length}
              theme={resolvedTheme}
              aspectRatio={aspectRatio}
              imageCache={imageCache}
              isExport={true}
              overlayOnly={true}
            />
          )}
        </div>
      </div>

      {/* ── Export overlay ── */}
      {exporting && (
        <div className="fixed inset-0 z-[60] bg-neutral-950/90 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader2 size={48} className="animate-spin mb-4 text-violet-400" />
          <h2 className="text-lg font-bold text-white">{exportStatusMsg || 'Rendering Slides...'}</h2>
          <p className="text-sm text-white/40 mt-1">
            {exportProgress.total > 1
              ? `${exportProgress.current} of ${exportProgress.total}`
              : exportProgress.current > 1
                ? `${exportProgress.current}%`
                : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function Header({ imageCache }) {
  return (
    <div className="flex-none h-14 border-b border-white/[0.06] flex items-center px-4">
      <img src={imageCache.favicon} className="w-6 h-6 rounded mr-2.5" alt="" />
      <span className="text-sm font-semibold text-white/70">Content Designer</span>
    </div>
  );
}
