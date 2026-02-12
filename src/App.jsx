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
  ImagePlus,
  Upload,
  RotateCw,
  MessageSquare,
  Twitter,
  BookOpen,
  Layers,
  Undo2,
  Redo2,
  Video,
  ImageIcon,
  Menu,
  X,
} from 'lucide-react';

import PasswordGate from './components/PasswordGate';
import ArticleFetcher from './components/ArticleFetcher';
import SlideCanvas from './components/SlideCanvas';
import ThemePicker from './components/ThemePicker';
import ThumbnailStrip from './components/ThumbnailStrip';
import StoryCanvas from './components/StoryCanvas';

import THEMES from './lib/themes';
import { getDominantColor, wcagTextColor, ensureContrast, darkenColor, lightenColor, hslToHex, rgbToHsl } from './lib/utils';
import { downloadAllAsZip, downloadAllIndividual, captureElement, captureOverlayAsPng } from './lib/exportEngine';
import { exportSlideAsVideo, getVideoExtension, exportYouTubeVideo } from './lib/videoExport';
import { fetchSettings } from './lib/ghostApi';
import { createBlankSlide, normaliseYouTubeUrl } from './lib/slideGenerator';
import { generateStories, createBlankStory } from './lib/storyGenerator';
import { generateCaption } from './lib/captionGenerator';
import { generateTweet, generateThread } from './lib/tweetGenerator';
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

  // Cover image override (hero image swap)
  const [coverOverride, setCoverOverride] = useState(null);
  const [coverYouTubeId, setCoverYouTubeId] = useState(null);
  const [coverMediaMode, setCoverMediaMode] = useState('thumbnail'); // 'thumbnail' | 'video'
  const [coverInputUrl, setCoverInputUrl] = useState(''); // raw URL user typed
  const coverBlobRef = useRef(null);

  // Story frames state
  const [storyFrames, setStoryFrames] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [editorTab, setEditorTab] = useState('slides'); // 'slides' | 'stories' | 'caption' | 'twitter'

  // Caption & Tweet state
  const [caption, setCaption] = useState({ hook: '', body: '', cta: '', hashtags: '' });
  const [tweetMode, setTweetMode] = useState('single'); // 'single' | 'thread'
  const [tweets, setTweets] = useState([]);
  const [threadTweets, setThreadTweets] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Undo/Redo history
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const pushHistory = useCallback((slidesSnapshot) => {
    const h = historyRef.current;
    const idx = historyIndexRef.current;
    // Trim any future states if we branched
    historyRef.current = h.slice(0, idx + 1);
    historyRef.current.push(JSON.parse(JSON.stringify(slidesSnapshot)));
    if (historyRef.current.length > 20) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

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
  const slideVideoUrls = useMemo(() => slides.map(s => s.videoUrl).join(','), [slides]);
  const resolvedColorImage = useMemo(
    () => coverOverride || resolveColorImage(article, slides),
    [coverOverride, article?.featureImage, article?.html, article?.tags, slideVideoUrls]
  );

  // ── Update cover image when article or override changes ──
  useEffect(() => {
    const img = coverOverride || article?.featureImage || resolvedColorImage;
    if (img) setImageCache((prev) => ({ ...prev, cover: img }));
  }, [coverOverride, article?.featureImage, resolvedColorImage]);

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
  const isStoryView = editorTab === 'stories';
  const previewW = 1080;
  const previewH = isStoryView ? 1920 : (aspectRatio === 'portrait' ? 1350 : 1080);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!previewContainerRef.current) return;
      const { width, height } = previewContainerRef.current.getBoundingClientRect();
      const isMobile = width < 640;
      const pad = isMobile ? 24 : 80;
      const scaleX = Math.max(0, width - pad) / previewW;
      const scaleY = Math.max(0, height - pad) / previewH;
      setScale(Math.min(scaleX, scaleY, 0.5));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mode, aspectRatio, editorTab, previewH]);

  // ── Handlers ──
  const handleSlidesGenerated = useCallback((newSlides, newArticle) => {
    setSlides(newSlides);
    setArticle(newArticle);
    setCurrentIndex(0);
    setCoverOverride(null);
    setCoverYouTubeId(null);
    setCoverMediaMode('thumbnail');
    setCoverInputUrl('');
    setEditorTab('slides');
    // Generate companion content
    setStoryFrames(generateStories(newArticle, newSlides));
    setCurrentStoryIndex(0);
    const cap = generateCaption(newArticle, newSlides);
    setCaption(cap);
    const singleTweets = generateTweet(newArticle);
    const thread = generateThread(newArticle, newSlides);
    setTweets(singleTweets);
    setThreadTweets(thread);
    setTweetMode('single');
    setMode('editor');
  }, []);

  // Start blank mode (no article)
  const handleStartBlank = useCallback(() => {
    const blankSlides = [
      createBlankSlide('cover', 0),
      createBlankSlide('content', 1),
      createBlankSlide('cta', 0),
    ];
    setSlides(blankSlides);
    setArticle(null);
    setCurrentIndex(0);
    setCoverOverride(null);
    setCoverYouTubeId(null);
    setCoverMediaMode('thumbnail');
    setCoverInputUrl('');
    setEditorTab('slides');
    setStoryFrames([createBlankStory('hook'), createBlankStory('cta')]);
    setCurrentStoryIndex(0);
    setCaption({ hook: '', body: '', cta: '', hashtags: '' });
    setTweets([]);
    setThreadTweets([]);
    setMode('editor');
  }, []);

  const handleReset = () => {
    setMode('input');
    setSlides([]);
    setArticle(null);
    setCurrentIndex(0);
    if (coverBlobRef.current) { URL.revokeObjectURL(coverBlobRef.current); coverBlobRef.current = null; }
    setCoverOverride(null);
    setCoverYouTubeId(null);
    setCoverMediaMode('thumbnail');
    setCoverInputUrl('');
    setStoryFrames([]);
    setCurrentStoryIndex(0);
    setEditorTab('slides');
    setCaption({ hook: '', body: '', cta: '', hashtags: '' });
    setTweets([]);
    setThreadTweets([]);
  };

  // Cover image swap handler — detect YouTube URLs, store video ID + thumbnail
  const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const handleCoverImageChange = (newUrl) => {
    setCoverInputUrl(newUrl);
    const ytId = extractYouTubeId(newUrl);
    if (ytId) {
      setCoverYouTubeId(ytId);
      // Always set thumbnail as coverOverride (used for color extraction + both modes)
      setCoverOverride(`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`);
    } else {
      setCoverYouTubeId(null);
      setCoverMediaMode('thumbnail');
      setCoverOverride(newUrl || null);
    }
  };

  const handleCoverFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverBlobRef.current) URL.revokeObjectURL(coverBlobRef.current);
    const url = URL.createObjectURL(file);
    coverBlobRef.current = url;
    setCoverOverride(url);
  };

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (coverBlobRef.current) URL.revokeObjectURL(coverBlobRef.current);
    };
  }, []);

  // Toast helper
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
  };

  // Undo/Redo actions
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const prev = historyRef.current[historyIndexRef.current];
    if (prev) setSlides(JSON.parse(JSON.stringify(prev)));
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const next = historyRef.current[historyIndexRef.current];
    if (next) setSlides(JSON.parse(JSON.stringify(next)));
  }, []);

  // Push to history whenever slides change (debounced via effect)
  const slidesJson = useMemo(() => JSON.stringify(slides), [slides]);
  useEffect(() => {
    if (slides.length === 0) return;
    // Simple debounce: only push if different from current history head
    const current = historyRef.current[historyIndexRef.current];
    if (JSON.stringify(current) !== slidesJson) {
      pushHistory(slides);
    }
  }, [slidesJson, pushHistory]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (mode !== 'editor') return;
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      const mod = e.ctrlKey || e.metaKey;
      // Undo: Ctrl/Cmd+Z (not in text inputs to avoid conflicting with native undo)
      if (mod && !e.shiftKey && e.key === 'z' && !isInput) {
        e.preventDefault(); undo();
      }
      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      if ((mod && e.shiftKey && (e.key === 'Z' || e.key === 'z')) || (mod && e.key === 'y' && !isInput)) {
        e.preventDefault(); redo();
      }
      // Navigate slides: ← / →  (only when not in a text input)
      if (!isInput && !mod && !e.altKey) {
        if (e.key === 'ArrowLeft') {
          if (isStoryView) setCurrentStoryIndex(i => Math.max(0, i - 1));
          else setCurrentIndex(i => Math.max(0, i - 1));
        }
        if (e.key === 'ArrowRight') {
          if (isStoryView) setCurrentStoryIndex(i => Math.min(storyFrames.length - 1, i + 1));
          else setCurrentIndex(i => Math.min(slides.length - 1, i + 1));
        }
      }
      // Reorder slides: Alt+← / Alt+→
      if (e.altKey && !mod && !isInput && editorTab === 'slides') {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          e.preventDefault();
          const ns = [...slides];
          [ns[currentIndex - 1], ns[currentIndex]] = [ns[currentIndex], ns[currentIndex - 1]];
          let num = 0;
          ns.forEach(s => { if (s.type === 'content') { num++; s.number = num; } });
          setSlides(ns);
          setCurrentIndex(currentIndex - 1);
        }
        if (e.key === 'ArrowRight' && currentIndex < slides.length - 1) {
          e.preventDefault();
          const ns = [...slides];
          [ns[currentIndex], ns[currentIndex + 1]] = [ns[currentIndex + 1], ns[currentIndex]];
          let num = 0;
          ns.forEach(s => { if (s.type === 'content') { num++; s.number = num; } });
          setSlides(ns);
          setCurrentIndex(currentIndex + 1);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, slides, currentIndex, editorTab, isStoryView, storyFrames.length, undo, redo]);

  const updateStoryField = useCallback((field, value) => {
    setStoryFrames(prev => prev.map((s, i) => i === currentStoryIndex ? { ...s, [field]: value } : s));
  }, [currentStoryIndex]);

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
        <ArticleFetcher onSlidesGenerated={handleSlidesGenerated} onStartBlank={handleStartBlank} />
      </div>
    );
  }

  // ── Editor mode ──
  const currentSlide = slides[currentIndex];

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-none h-12 md:h-14 border-b border-white/[0.06] flex items-center justify-between px-2 md:px-4 z-30 bg-neutral-950">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="md:hidden p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all flex-shrink-0" title="Toggle panel">
            {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <img src={imageCache.favicon} className="w-5 h-5 md:w-6 md:h-6 rounded flex-shrink-0" alt="" />
          <span className="text-sm font-semibold text-white/70 hidden sm:inline">Content Designer</span>
          <span className="text-white/20 hidden md:inline">·</span>
          <span className="text-xs text-white/30 truncate max-w-[200px] hidden md:inline">{article?.title}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={undo} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all disabled:opacity-15 hidden sm:block" title="Undo (Ctrl+Z)" disabled={historyIndexRef.current <= 0}>
            <Undo2 size={15} />
          </button>
          <button onClick={redo} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all disabled:opacity-15 hidden sm:block" title="Redo (Ctrl+Shift+Z)" disabled={historyIndexRef.current >= historyRef.current.length - 1}>
            <Redo2 size={15} />
          </button>
          <div className="w-px h-5 bg-white/[0.06] mx-0.5 hidden sm:block" />
          <button onClick={handleReset} className="px-2 md:px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white/80 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-all flex items-center gap-1 md:gap-1.5">
            <RotateCcw size={13} /> <span className="hidden sm:inline">New</span>
          </button>
          <div className="relative">
            <button onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={exporting} className="px-2.5 md:px-4 py-1.5 text-xs font-semibold bg-white text-neutral-950 rounded-lg hover:bg-white/90 transition-all flex items-center gap-1 md:gap-1.5 disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="hidden sm:inline">Export</span> <ChevronDown size={12} />
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
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Mobile sidebar backdrop ── */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* ── Left Sidebar ── */}
        <div className={`
          fixed top-12 bottom-0 left-0 z-40 w-[85vw] max-w-[320px] transform transition-transform duration-300 ease-in-out
          md:relative md:top-auto md:bottom-auto md:inset-auto md:z-auto md:w-72 md:max-w-none md:transform-none
          flex-none border-r border-white/[0.06] flex flex-col bg-neutral-950
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Tab bar */}
          <div className="flex-none flex border-b border-white/[0.06]">
            {[
              { id: 'slides', icon: Layers, label: 'Slides' },
              { id: 'stories', icon: BookOpen, label: 'Stories' },
              { id: 'caption', icon: MessageSquare, label: 'Caption' },
              { id: 'twitter', icon: Twitter, label: 'Twitter' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { setEditorTab(id); }}
                className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
                  editorTab === id ? 'text-white bg-white/[0.04] border-b-2 border-violet-500' : 'text-white/30 hover:text-white/50'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
            {/* ── Slides Tab ── */}
            {editorTab === 'slides' && (
              <>
                <div className="p-4 space-y-5 border-b border-white/[0.06]">
                  <ThemePicker activeThemeId={activeThemeId} onThemeChange={setActiveThemeId} dynamicPreview={dynamicTheme} />
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Aspect Ratio</label>
                    <div className="flex bg-white/[0.04] p-1 rounded-lg">
                      <button onClick={() => setAspectRatio('square')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${aspectRatio === 'square' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>1:1</button>
                      <button onClick={() => setAspectRatio('portrait')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${aspectRatio === 'portrait' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>4:5</button>
                    </div>
                  </div>
                  {/* Cover Image Swap */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Cover Image</label>
                    {imageCache.cover && (
                      <div className="rounded-lg overflow-hidden border border-white/[0.06]" style={{ height: 56 }}>
                        <img src={imageCache.cover} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <input
                      type="text"
                      value={coverInputUrl}
                      onChange={(e) => handleCoverImageChange(e.target.value)}
                      placeholder="Image or YouTube URL to override..."
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15"
                    />
                    {/* YouTube detected — show video/thumbnail toggle */}
                    {coverYouTubeId && (
                      <div className="flex bg-white/[0.04] p-0.5 rounded-lg">
                        <button onClick={() => setCoverMediaMode('thumbnail')} className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${coverMediaMode === 'thumbnail' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>
                          <ImageIcon size={11} /> Thumbnail
                        </button>
                        <button onClick={() => setCoverMediaMode('video')} className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${coverMediaMode === 'video' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>
                          <Video size={11} /> Video Autoplay
                        </button>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-white/40 hover:text-white/70 bg-white/[0.04] border border-white/[0.08] rounded-lg cursor-pointer hover:bg-white/[0.06] transition-all">
                        <Upload size={12} /> Upload File
                        <input type="file" accept="image/*" onChange={handleCoverFileUpload} className="hidden" />
                      </label>
                      {coverOverride && article?.featureImage && (
                        <button
                          onClick={() => { setCoverOverride(null); setCoverYouTubeId(null); setCoverMediaMode('thumbnail'); setCoverInputUrl(''); }}
                          className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-white/40 hover:text-white/70 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-all"
                        >
                          <RotateCw size={11} /> Reset
                        </button>
                      )}
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
              </>
            )}

            {/* ── Stories Tab ── */}
            {editorTab === 'stories' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
                    Story {currentStoryIndex + 1} of {storyFrames.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const ns = createBlankStory('hook');
                        const nf = [...storyFrames];
                        nf.splice(currentStoryIndex + 1, 0, ns);
                        setStoryFrames(nf);
                        setCurrentStoryIndex(currentStoryIndex + 1);
                      }}
                      className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Add story frame"
                    ><Plus size={14} /></button>
                    <button
                      onClick={() => {
                        if (storyFrames.length <= 1) return;
                        const nf = storyFrames.filter((_, i) => i !== currentStoryIndex);
                        setStoryFrames(nf);
                        setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
                      }}
                      disabled={storyFrames.length <= 1}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-20" title="Delete story frame"
                    ><Trash2 size={14} /></button>
                  </div>
                </div>
                {storyFrames[currentStoryIndex] && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Type</label>
                        <div className="flex bg-white/[0.04] p-1 rounded-lg">
                          {['hook', 'teaser', 'poll', 'cta'].map(t => (
                            <button key={t} onClick={() => updateStoryField('type', t)} className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all capitalize ${storyFrames[currentStoryIndex].type === t ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>{t}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Headline</label>
                        <textarea value={storyFrames[currentStoryIndex].headline || ''} onChange={(e) => updateStoryField('headline', e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Subtext</label>
                        <textarea value={storyFrames[currentStoryIndex].subtext || ''} onChange={(e) => updateStoryField('subtext', e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                      </div>
                      {storyFrames[currentStoryIndex].type === 'poll' && (
                        <div>
                          <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Poll Options</label>
                          {(storyFrames[currentStoryIndex].pollOptions || ['Yes', 'No']).map((opt, oi) => (
                            <input key={oi} type="text" value={opt} onChange={(e) => {
                              const opts = [...(storyFrames[currentStoryIndex].pollOptions || ['Yes', 'No'])];
                              opts[oi] = e.target.value;
                              updateStoryField('pollOptions', opts);
                            }} className="w-full mb-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors" />
                          ))}
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">CTA Label</label>
                        <input type="text" value={storyFrames[currentStoryIndex].ctaLabel || ''} onChange={(e) => updateStoryField('ctaLabel', e.target.value)} placeholder="Swipe up · See carousel" className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                      </div>
                    </div>
                )}
              </div>
            )}

            {/* ── Caption Tab ── */}
            {editorTab === 'caption' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Instagram Caption</span>
                  <div className="flex gap-1">
                    {article && (
                      <button onClick={() => setCaption(generateCaption(article, slides))} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Regenerate"><RotateCw size={13} /></button>
                    )}
                    <button onClick={() => copyToClipboard(`${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${caption.hashtags}`)} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Copy all"><Copy size={13} /></button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Hook Line</label>
                  <textarea value={caption.hook} onChange={(e) => setCaption(p => ({ ...p, hook: e.target.value }))} rows={2} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Body</label>
                  <textarea value={caption.body} onChange={(e) => setCaption(p => ({ ...p, body: e.target.value }))} rows={5} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">CTA</label>
                  <textarea value={caption.cta} onChange={(e) => setCaption(p => ({ ...p, cta: e.target.value }))} rows={2} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Hashtags</span>
                    <button onClick={() => copyToClipboard(caption.hashtags)} className="text-white/30 hover:text-white/60 transition-colors" title="Copy hashtags"><Copy size={11} /></button>
                  </label>
                  <textarea value={caption.hashtags} onChange={(e) => setCaption(p => ({ ...p, hashtags: e.target.value }))} rows={3} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 outline-none focus:border-white/20 transition-colors resize-none" />
                </div>
                <div className="text-[10px] text-white/20 text-right">
                  {`${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${caption.hashtags}`.length} / 2,200 chars
                </div>
              </div>
            )}

            {/* ── Twitter Tab ── */}
            {editorTab === 'twitter' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Twitter / X</span>
                  <div className="flex gap-1">
                    {article && (
                      <button onClick={() => {
                        if (tweetMode === 'single') { const t = generateTweet(article); setTweets(t); }
                        else { const t = generateThread(article, slides); setThreadTweets(t); }
                      }} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Regenerate"><RotateCw size={13} /></button>
                    )}
                    <button onClick={() => { const active = tweetMode === 'single' ? tweets : threadTweets; copyToClipboard(active.map(t => typeof t === 'string' ? t : t.text).join('\n\n---\n\n')); }} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Copy all"><Copy size={13} /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Mode</label>
                  <div className="flex bg-white/[0.04] p-1 rounded-lg">
                    <button onClick={() => { setTweetMode('single'); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tweetMode === 'single' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>Single</button>
                    <button onClick={() => { setTweetMode('thread'); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tweetMode === 'thread' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>Thread</button>
                  </div>
                </div>
                {(tweetMode === 'single' ? tweets : threadTweets).map((tw, i) => {
                  const text = typeof tw === 'string' ? tw : tw.text;
                  const setter = tweetMode === 'single' ? setTweets : setThreadTweets;
                  return (
                    <div key={i} className="space-y-1">
                      {tweetMode === 'thread' && <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider">Tweet {i + 1} / {threadTweets.length}</label>}
                      <textarea
                        value={text}
                        onChange={(e) => {
                          setter(prev => prev.map((t, j) => j === i ? (typeof t === 'string' ? e.target.value : { ...t, text: e.target.value }) : t));
                        }}
                        rows={3}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] ${text.length > 280 ? 'text-red-400' : text.length > 260 ? 'text-yellow-400/70' : 'text-white/20'}`}>
                          {text.length} / 280
                        </span>
                        <button onClick={() => copyToClipboard(text)} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">Copy</button>
                      </div>
                    </div>
                  );
                })}
                {tweetMode === 'thread' && (
                  <button
                    onClick={() => setThreadTweets(prev => [...prev, ''])}
                    className="w-full py-2 text-xs text-white/30 hover:text-white/60 border border-dashed border-white/[0.08] rounded-lg hover:bg-white/[0.02] transition-all flex items-center justify-center gap-1"
                  >
                    <Plus size={12} /> Add Tweet
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Center Preview ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={previewContainerRef} className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            {/* Slides / Stories preview */}
            {(editorTab === 'slides' || editorTab === 'caption' || editorTab === 'twitter') && (
              <div className="flex items-center gap-1 sm:gap-4 z-10 relative px-1 sm:px-0">
                <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="p-1.5 sm:p-3 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 disabled:opacity-20 hover:bg-white/[0.1] transition-all flex-shrink-0"><ArrowLeft size={16} /></button>
                <div className="relative slide-shadow rounded-sm" style={{ width: previewW * scale, height: previewH * scale }}>
                  <div className="absolute top-0 left-0 origin-top-left" style={{ width: previewW, height: previewH, transform: `scale(${scale})` }}>
                    <SlideCanvas slide={currentSlide} index={currentIndex} totalSlides={slides.length} theme={resolvedTheme} aspectRatio={aspectRatio} imageCache={imageCache} coverYouTubeId={coverYouTubeId} coverMediaMode={coverMediaMode} />
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity z-20">
                    <button onClick={handleExportSingle} disabled={exporting} className="p-2 bg-black/70 text-white rounded-lg hover:bg-black backdrop-blur-sm border border-white/10" title="Download this slide"><Download size={16} /></button>
                  </div>
                </div>
                <button onClick={() => setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))} disabled={currentIndex === slides.length - 1} className="p-1.5 sm:p-3 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 disabled:opacity-20 hover:bg-white/[0.1] transition-all flex-shrink-0"><ArrowRight size={16} /></button>
              </div>
            )}

            {editorTab === 'stories' && storyFrames.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-4 z-10 relative px-1 sm:px-0">
                <button onClick={() => setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1))} disabled={currentStoryIndex === 0} className="p-1.5 sm:p-3 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 disabled:opacity-20 hover:bg-white/[0.1] transition-all flex-shrink-0"><ArrowLeft size={16} /></button>
                <div className="relative slide-shadow rounded-sm" style={{ width: previewW * scale, height: previewH * scale }}>
                  <div className="absolute top-0 left-0 origin-top-left" style={{ width: previewW, height: previewH, transform: `scale(${scale})` }}>
                    <StoryCanvas frame={storyFrames[currentStoryIndex]} index={currentStoryIndex} totalFrames={storyFrames.length} theme={resolvedTheme} imageCache={imageCache} coverOverride={coverOverride} coverYouTubeId={coverYouTubeId} coverMediaMode={coverMediaMode} />
                  </div>
                </div>
                <button onClick={() => setCurrentStoryIndex(Math.min(storyFrames.length - 1, currentStoryIndex + 1))} disabled={currentStoryIndex === storyFrames.length - 1} className="p-1.5 sm:p-3 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 disabled:opacity-20 hover:bg-white/[0.1] transition-all flex-shrink-0"><ArrowRight size={16} /></button>
              </div>
            )}
          </div>

          {/* Mobile bottom tab bar — quick tab switching without opening sidebar */}
          <div className="flex-none flex md:hidden border-t border-white/[0.06] bg-neutral-950">
            {[
              { id: 'slides', icon: Layers, label: 'Slides' },
              { id: 'stories', icon: BookOpen, label: 'Stories' },
              { id: 'caption', icon: MessageSquare, label: 'Caption' },
              { id: 'twitter', icon: Twitter, label: 'Twitter' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { setEditorTab(id); setMobileSidebarOpen(false); }}
                className={`flex-1 py-2 text-[9px] font-semibold uppercase tracking-wider flex flex-col items-center gap-0.5 transition-all ${
                  editorTab === id ? 'text-violet-400' : 'text-white/30'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Thumbnail strip — slides or stories */}
          <div className="flex-none border-t border-white/[0.06] bg-neutral-950/80 px-2 md:px-4 py-1.5 md:py-2">
            {editorTab === 'stories' ? (
              <div className="flex gap-1.5 md:gap-2 overflow-x-auto py-1 md:py-2 px-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                {storyFrames.map((sf, i) => (
                  <button
                    key={sf.id}
                    onClick={() => setCurrentStoryIndex(i)}
                    className={`flex-shrink-0 rounded-lg border-2 transition-all overflow-hidden relative ${
                      i === currentStoryIndex
                        ? 'border-violet-500 ring-2 ring-violet-500/30 scale-105'
                        : 'border-white/[0.06] hover:border-white/20 opacity-60 hover:opacity-100'
                    }`}
                    style={{ width: 36, height: 64 }}
                  >
                    <div style={{ width: 1080, height: 1920, transform: `scale(${36 / 1080})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                      <StoryCanvas frame={sf} index={i} totalFrames={storyFrames.length} theme={resolvedTheme} imageCache={imageCache} coverOverride={coverOverride} coverYouTubeId={coverYouTubeId} coverMediaMode={coverMediaMode} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <ThumbnailStrip slides={slides} currentIndex={currentIndex} onSelect={setCurrentIndex} theme={resolvedTheme} aspectRatio={aspectRatio} imageCache={imageCache} />
            )}
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

      {/* ── Toast notification ── */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 bg-neutral-800 border border-white/[0.1] rounded-xl text-sm text-white/80 shadow-2xl animate-fade-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

function Header({ imageCache }) {
  return (
    <div className="flex-none h-12 md:h-14 border-b border-white/[0.06] flex items-center px-3 md:px-4">
      <img src={imageCache.favicon} className="w-5 h-5 md:w-6 md:h-6 rounded mr-2 md:mr-2.5" alt="" />
      <span className="text-sm font-semibold text-white/70">Content Designer</span>
    </div>
  );
}
