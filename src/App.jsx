import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Download, Loader2, X, Layers, BookOpen, MessageSquare, Twitter, Headphones } from 'lucide-react';

import PasswordGate from './components/PasswordGate';
import ArticleFetcher from './components/ArticleFetcher';
import SlideCanvas from './components/SlideCanvas';
import ThumbnailStrip from './components/ThumbnailStrip';
import StoryCanvas from './components/StoryCanvas';
import TopBar from './components/TopBar';
import EditorSidebar from './components/EditorSidebar';
import PodcastCanvas, { PODCAST_W, PODCAST_H } from './components/PodcastCanvas';
import PodcastThumbnail, { THUMB_W, THUMB_H } from './components/PodcastThumbnail';

import THEMES from './lib/themes';
import { getDominantColor, ensureContrast, hslToHex, rgbToHsl } from './lib/utils';
import { fetchSettings } from './lib/ghostApi';
import { createBlankSlide, generateSlides } from './lib/slideGenerator';
import { generateStories, createBlankStory } from './lib/storyGenerator';
import { generateCaption } from './lib/captionGenerator';
import { generateTweet, generateThread } from './lib/tweetGenerator';
import useExportHandlers from './hooks/useExportHandlers';
import CONFIG from './config';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState('input');

  // Slides state
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [article, setArticle] = useState(null);
  const [density, setDensity] = useState('balanced');

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
  const [editorTab, setEditorTab] = useState('slides'); // 'slides' | 'stories' | 'caption' | 'twitter' | 'podcast'

  // Podcast state
  const [podcastMeta, setPodcastMeta] = useState({
    title: 'BeatPass Podcast',
    episodeNumber: 1,
    subtitle: '',
    guestName: '',
    audioDuration: 0,
    coverImage: null,
  });
  const [podcastAudioFile, setPodcastAudioFile] = useState(null);
  const [podcastAudioName, setPodcastAudioName] = useState('');
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const [podcastElapsed, setPodcastElapsed] = useState(0);
  const podcastAudioRef = useRef(null);
  const podcastAudioUrlRef = useRef(null);

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
  const [historyVersion, setHistoryVersion] = useState(0);
  const pushHistory = useCallback((slidesSnapshot) => {
    const h = historyRef.current;
    const idx = historyIndexRef.current;
    // Trim any future states if we branched
    historyRef.current = h.slice(0, idx + 1);
    historyRef.current.push(JSON.parse(JSON.stringify(slidesSnapshot)));
    if (historyRef.current.length > 20) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryVersion(v => v + 1);
  }, []);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Refs
  const previewContainerRef = useRef(null);
  const exportContainerRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const storyExportContainerRef = useRef(null);
  const podcastExportContainerRef = useRef(null);
  const podcastExportLitRef = useRef(null);
  const podcastOverlayContainerRef = useRef(null);
  const podcastThumbnailRef = useRef(null);
  const [scale, setScale] = useState(0.3);

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

  // ── Export handlers (extracted hook) ──
  const exportH = useExportHandlers({
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
  });

  // ── Podcast audio playback ──
  useEffect(() => {
    // Create Audio element once
    if (!podcastAudioRef.current) {
      podcastAudioRef.current = new Audio();
    }
    const audio = podcastAudioRef.current;

    // When audio file changes, set new source
    if (podcastAudioFile) {
      if (podcastAudioUrlRef.current) URL.revokeObjectURL(podcastAudioUrlRef.current);
      const url = URL.createObjectURL(podcastAudioFile);
      podcastAudioUrlRef.current = url;
      audio.src = url;
      audio.load();
      setPodcastPlaying(false);
      setPodcastElapsed(0);
    } else {
      audio.pause();
      audio.src = '';
      if (podcastAudioUrlRef.current) { URL.revokeObjectURL(podcastAudioUrlRef.current); podcastAudioUrlRef.current = null; }
      setPodcastPlaying(false);
      setPodcastElapsed(0);
    }

    const onTimeUpdate = () => setPodcastElapsed(audio.currentTime);
    const onEnded = () => { setPodcastPlaying(false); setPodcastElapsed(0); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [podcastAudioFile]);

  // Pause podcast audio when switching away from podcast tab or when export starts
  useEffect(() => {
    if (editorTab !== 'podcast' && podcastAudioRef.current) {
      podcastAudioRef.current.pause();
      setPodcastPlaying(false);
    }
  }, [editorTab]);

  // Sync playing state if audio is paused externally (e.g. by export handler)
  useEffect(() => {
    const audio = podcastAudioRef.current;
    if (!audio) return;
    const onPause = () => setPodcastPlaying(false);
    const onPlay = () => setPodcastPlaying(true);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    return () => { audio.removeEventListener('pause', onPause); audio.removeEventListener('play', onPlay); };
  }, [podcastAudioFile]);

  const togglePodcastPlayback = useCallback(() => {
    const audio = podcastAudioRef.current;
    if (!audio || !podcastAudioFile) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setPodcastPlaying(true);
    } else {
      audio.pause();
      setPodcastPlaying(false);
    }
  }, [podcastAudioFile]);

  const seekPodcast = useCallback((pct) => {
    const audio = podcastAudioRef.current;
    if (!audio || !podcastMeta.audioDuration) return;
    audio.currentTime = pct * podcastMeta.audioDuration;
    setPodcastElapsed(audio.currentTime);
  }, [podcastMeta.audioDuration]);

  // ── Cancel podcast render on browser close/refresh ──
  useEffect(() => {
    const onBeforeUnload = () => {
      if (exportH.podcastJobId) {
        const blob = new Blob([JSON.stringify({ jobId: exportH.podcastJobId })], { type: 'application/json' });
        navigator.sendBeacon?.('/video-api/podcast-cancel', blob);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [exportH.podcastJobId]);

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
  // Extracts hue via median-cut quantization, then builds a dark palette.
  // Every color pair is verified against WCAG 2.1 contrast requirements:
  //   text/bg ≥ 4.5:1 (AA normal text)
  //   muted/bg ≥ 4.5:1 (AA normal text — muted IS body text)
  //   accent/bg ≥ 3:1 (AA large text / UI components)
  //   accentText/accentBg ≥ 4.5:1 (AA normal — badge text)
  useEffect(() => {
    const imgSrc = resolvedColorImage;
    if (!imgSrc) return;
    (async () => {
      const raw = await getDominantColor(imgSrc);
      const hsl = rgbToHsl(raw.r, raw.g, raw.b);

      // Background: keep hue, cap saturation, force very dark (l ≈ 0.07–0.09)
      const bgSat = Math.min(hsl.s, 0.45);
      const bgHex = hslToHex(hsl.h, bgSat, 0.08);

      // Text: hue-tinted off-white for cohesion — verified AA 4.5:1
      const textCandidate = hslToHex(hsl.h, 0.08, 0.88);
      const textColor = ensureContrast(bgHex, textCandidate, 4.5);

      // Accent: same hue, boosted saturation, mid-high lightness
      const accentSat = Math.max(hsl.s, 0.50);
      const accentHex = hslToHex(hsl.h, accentSat, 0.58);
      // Accent on bg only needs 3:1 (large text / non-text UI per WCAG 1.4.11)
      const finalAccent = ensureContrast(bgHex, accentHex, 3);

      // Muted: desaturated tint — used for body text so needs full 4.5:1
      const mutedCandidate = hslToHex(hsl.h, 0.12, 0.62);
      const finalMuted = ensureContrast(bgHex, mutedCandidate, 4.5);

      // Accent badge text: needs 4.5:1 against accent background
      const accentTextCandidate = hslToHex(hsl.h, 0.30, 0.12);
      const accentText = ensureContrast(finalAccent, accentTextCandidate, 4.5);

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
  const isPodcastView = editorTab === 'podcast';
  const previewW = isPodcastView ? PODCAST_W : 1080;
  const previewH = isPodcastView ? PODCAST_H : isStoryView ? 1920 : (aspectRatio === 'portrait' ? 1350 : 1080);

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
  const handleSlidesGenerated = useCallback((newSlides, newArticle, newDensity) => {
    setSlides(newSlides);
    setArticle(newArticle);
    if (newDensity) setDensity(newDensity);
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
    // Auto-populate podcast metadata from article
    setPodcastMeta(prev => ({
      ...prev,
      subtitle: newArticle?.title || '',
      coverImage: newArticle?.featureImage || null,
    }));
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

  // Regenerate slides from the same article with a new density
  const handleRegenerate = useCallback((newDensity) => {
    if (!article) return;
    const d = newDensity || density;
    setDensity(d);
    const newSlides = generateSlides(article, { density: d });
    setSlides(newSlides);
    setCurrentIndex(0);
    // Regenerate companion content
    setStoryFrames(generateStories(article, newSlides));
    setCurrentStoryIndex(0);
    const cap = generateCaption(article, newSlides);
    setCaption(cap);
    setTweets(generateTweet(article));
    setThreadTweets(generateThread(article, newSlides));
  }, [article, density]);

  const handleReset = () => {
    setMode('input');
    setSlides([]);
    setArticle(null);
    setCurrentIndex(0);
    setDensity('balanced');
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
    setPodcastMeta({ title: 'BeatPass Podcast', episodeNumber: 1, subtitle: '', guestName: '', audioDuration: 0, coverImage: null, waveformPeaks: null });
    setPodcastAudioFile(null);
    setPodcastAudioName('');
    setPodcastPlaying(false);
    setPodcastElapsed(0);
    if (podcastAudioRef.current) { podcastAudioRef.current.pause(); podcastAudioRef.current.src = ''; }
    if (podcastAudioUrlRef.current) { URL.revokeObjectURL(podcastAudioUrlRef.current); podcastAudioUrlRef.current = null; }
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
    setHistoryVersion(v => v + 1);
    const prev = historyRef.current[historyIndexRef.current];
    if (prev) setSlides(JSON.parse(JSON.stringify(prev)));
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    setHistoryVersion(v => v + 1);
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

  /**
   * Update one or more fields on a slide.
   * @param {string} id - Slide identifier.
   * @param {string|Object} field - Property name for single update, or an object
   *   of { prop: value } pairs for batch updates.
   * @param {*} [value] - New value when `field` is a string (omit for batch mode).
   * @example updateSlideField(id, 'title', 'New Title')
   * @example updateSlideField(id, { title: 'New', subtitle: 'Fields' })
   */
  const updateSlideField = (id, field, value) => {
    if (typeof field === 'object' && value === undefined) {
      setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...field } : s)));
    } else {
      setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    }
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
    <div className="fixed inset-0 bg-surface text-white flex flex-col overflow-hidden">
      <TopBar
        imageCache={imageCache}
        article={article}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        undo={undo}
        redo={redo}
        canUndo={historyVersion >= 0 && historyIndexRef.current > 0}
        canRedo={historyVersion >= 0 && historyIndexRef.current < historyRef.current.length - 1}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onReset={handleReset}
        exporting={exportH.exporting}
        exportMenuOpen={exportH.exportMenuOpen}
        setExportMenuOpen={exportH.setExportMenuOpen}
        editorTab={editorTab}
        currentSlide={currentSlide}
        isCurrentGif={exportH.isCurrentGif}
        isCurrentYt={exportH.isCurrentYt}
        onExportSingle={exportH.handleExportSingle}
        onExportAllZip={exportH.handleExportAllZip}
        onExportAllPngs={exportH.handleExportAllPngs}
        onExportVideo={exportH.handleExportVideo}
        onExportVideoWithAudio={exportH.handleExportVideoWithAudio}
        onExportStory={exportH.handleExportStory}
        onExportAllStoriesZip={exportH.handleExportAllStoriesZip}
        onExportPodcast={exportH.handleExportPodcast}
        onExportPodcastThumbnail={exportH.handleExportPodcastThumbnail}
        hasPodcastAudio={!!podcastAudioFile}
      />

      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Mobile sidebar backdrop ── */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 glass-light z-30 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}

        <EditorSidebar
          editorTab={editorTab}
          setEditorTab={setEditorTab}
          mobileSidebarOpen={mobileSidebarOpen}
          activeThemeId={activeThemeId}
          setActiveThemeId={setActiveThemeId}
          dynamicTheme={dynamicTheme}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          density={density}
          article={article}
          slides={slides}
          onRegenerate={handleRegenerate}
          imageCache={imageCache}
          coverOverride={coverOverride}
          coverInputUrl={coverInputUrl}
          coverYouTubeId={coverYouTubeId}
          coverMediaMode={coverMediaMode}
          setCoverMediaMode={setCoverMediaMode}
          onCoverImageChange={handleCoverImageChange}
          onCoverFileUpload={handleCoverFileUpload}
          onCoverReset={() => { setCoverOverride(null); setCoverYouTubeId(null); setCoverMediaMode('thumbnail'); setCoverInputUrl(''); }}
          currentIndex={currentIndex}
          currentSlide={currentSlide}
          onUpdateSlideField={updateSlideField}
          onAddSlideAfter={addSlideAfter}
          onDuplicateSlide={duplicateCurrentSlide}
          onDeleteSlide={deleteCurrentSlide}
          storyFrames={storyFrames}
          setStoryFrames={setStoryFrames}
          currentStoryIndex={currentStoryIndex}
          setCurrentStoryIndex={setCurrentStoryIndex}
          onUpdateStoryField={updateStoryField}
          caption={caption}
          setCaption={setCaption}
          tweetMode={tweetMode}
          setTweetMode={setTweetMode}
          tweets={tweets}
          setTweets={setTweets}
          threadTweets={threadTweets}
          setThreadTweets={setThreadTweets}
          copyToClipboard={copyToClipboard}
          podcastMeta={podcastMeta}
          setPodcastMeta={setPodcastMeta}
          podcastAudioFile={podcastAudioFile}
          setPodcastAudioFile={setPodcastAudioFile}
          podcastAudioName={podcastAudioName}
          setPodcastAudioName={setPodcastAudioName}
          onExportPodcast={exportH.handleExportPodcast}
          onExportPodcastThumbnail={exportH.handleExportPodcastThumbnail}
          exporting={exportH.exporting}
          podcastExporting={exportH.podcastExporting}
        />

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
                    <button onClick={exportH.handleExportSingle} disabled={exportH.exporting} className="p-2 bg-black/70 text-white rounded-lg hover:bg-black backdrop-blur-sm border border-white/10" title="Download this slide"><Download size={16} /></button>
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
                  <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity z-20">
                    <button onClick={exportH.handleExportStory} disabled={exportH.exporting} className="p-2 bg-black/70 text-white rounded-lg hover:bg-black backdrop-blur-sm border border-white/10" title="Download this story"><Download size={16} /></button>
                  </div>
                </div>
                <button onClick={() => setCurrentStoryIndex(Math.min(storyFrames.length - 1, currentStoryIndex + 1))} disabled={currentStoryIndex === storyFrames.length - 1} className="p-1.5 sm:p-3 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 disabled:opacity-20 hover:bg-white/[0.1] transition-all flex-shrink-0"><ArrowRight size={16} /></button>
              </div>
            )}

            {/* Podcast preview */}
            {editorTab === 'podcast' && (
              <div className="z-10 relative px-1 sm:px-0 flex flex-col items-center gap-3">
                <div className="relative slide-shadow rounded-sm" style={{ width: previewW * scale, height: previewH * scale }}>
                  <div className="absolute top-0 left-0 origin-top-left" style={{ width: previewW, height: previewH, transform: `scale(${scale})` }}>
                    <PodcastCanvas theme={resolvedTheme} imageCache={imageCache} podcastMeta={podcastMeta} elapsed={podcastElapsed} />
                  </div>
                </div>
                {/* Mini transport bar */}
                {podcastAudioFile && (
                  <div className="flex items-center gap-3 w-full px-4" style={{ maxWidth: previewW * scale }}>
                    <button
                      onClick={togglePodcastPlayback}
                      className="p-2 bg-white/[0.08] border border-white/[0.1] rounded-full text-white/70 hover:bg-white/[0.14] hover:text-white transition-all flex-shrink-0"
                      title={podcastPlaying ? 'Pause' : 'Play'}
                    >
                      {podcastPlaying
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      }
                    </button>
                    <div
                      className="flex-1 py-2 cursor-pointer relative group"
                      onClick={(e) => {
                        const bar = e.currentTarget.querySelector('[data-seek-track]');
                        if (!bar) return;
                        const rect = bar.getBoundingClientRect();
                        seekPodcast(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                      }}
                    >
                      <div data-seek-track className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-[width] duration-200"
                          style={{ width: `${podcastMeta.audioDuration > 0 ? (podcastElapsed / podcastMeta.audioDuration) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-white/30 font-mono tabular-nums flex-shrink-0">
                      {Math.floor(podcastElapsed / 60)}:{String(Math.floor(podcastElapsed % 60)).padStart(2, '0')}
                      <span className="text-white/15"> / </span>
                      {Math.floor((podcastMeta.audioDuration || 0) / 60)}:{String(Math.floor((podcastMeta.audioDuration || 0) % 60)).padStart(2, '0')}
                    </span>
                  </div>
                )}
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
              { id: 'podcast', icon: Headphones, label: 'Podcast' },
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

          {/* Thumbnail strip — slides or stories (hidden on podcast tab) */}
          <div className="flex-none border-t border-white/[0.06] bg-neutral-950/80 px-2 md:px-4 py-1.5 md:py-2">
            {editorTab === 'podcast' ? (
              <div className="flex items-center justify-center py-2 text-[10px] text-white/20">
                <Headphones size={12} className="mr-1.5" />
                1920×1080 HD · Podcast Video
              </div>
            ) : editorTab === 'stories' ? (
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

      {/* ── ALWAYS-RENDERED slide export container ──
           Off-screen — html-to-image clones the DOM so visibility isn't needed. */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: exportH.slideWidth,
          height: exportH.slideHeight,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div ref={exportContainerRef} style={{ width: exportH.slideWidth, height: exportH.slideHeight }}>
          {slides.length > 0 && (
            <SlideCanvas
              slide={slides[exportH.exporting ? exportH.exportIndex : currentIndex]}
              index={exportH.exporting ? exportH.exportIndex : currentIndex}
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
          width: exportH.slideWidth, height: exportH.slideHeight,
          overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
        }}
      >
        <div ref={overlayContainerRef} style={{ width: exportH.slideWidth, height: exportH.slideHeight }}>
          {slides.length > 0 && (
            <SlideCanvas
              slide={slides[exportH.exporting ? exportH.exportIndex : currentIndex]}
              index={exportH.exporting ? exportH.exportIndex : currentIndex}
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

      {/* ── Off-screen story export container (1080×1920) ── */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: exportH.storyWidth,
          height: exportH.storyHeight,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div ref={storyExportContainerRef} style={{ width: exportH.storyWidth, height: exportH.storyHeight }}>
          {storyFrames.length > 0 && (
            <StoryCanvas
              frame={storyFrames[exportH.exporting ? exportH.storyExportIndex : currentStoryIndex]}
              index={exportH.exporting ? exportH.storyExportIndex : currentStoryIndex}
              totalFrames={storyFrames.length}
              theme={resolvedTheme}
              imageCache={imageCache}
              coverOverride={coverOverride}
              coverYouTubeId={coverYouTubeId}
              coverMediaMode={coverMediaMode}
              isExport={true}
            />
          )}
        </div>
      </div>

      {/* ── Off-screen podcast export container (1920×1080) ── */}
      <div
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: PODCAST_W, height: PODCAST_H,
          overflow: 'hidden', pointerEvents: 'none',
        }}
      >
        <div ref={podcastExportContainerRef} style={{ width: PODCAST_W, height: PODCAST_H }}>
          <PodcastCanvas theme={resolvedTheme} imageCache={imageCache} podcastMeta={podcastMeta} isExport={true} />
        </div>
      </div>

      {/* ── Off-screen podcast export container — LIT waveform (all bars highlighted) ── */}
      <div
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: PODCAST_W, height: PODCAST_H,
          overflow: 'hidden', pointerEvents: 'none',
        }}
      >
        <div ref={podcastExportLitRef} style={{ width: PODCAST_W, height: PODCAST_H }}>
          <PodcastCanvas theme={resolvedTheme} imageCache={imageCache} podcastMeta={podcastMeta} isExport={true} elapsed={podcastMeta.audioDuration || 99999} />
        </div>
      </div>

      {/* ── Off-screen podcast overlay container (transparent bg for ffmpeg composite) ── */}
      <div
        style={{
          position: 'fixed', top: -9999, left: -9999,
          width: PODCAST_W, height: PODCAST_H,
          overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
        }}
      >
        <div ref={podcastOverlayContainerRef} style={{ width: PODCAST_W, height: PODCAST_H }}>
          <PodcastCanvas theme={resolvedTheme} imageCache={imageCache} podcastMeta={podcastMeta} isExport={true} overlayOnly={true} />
        </div>
      </div>

      {/* ── Off-screen podcast YouTube thumbnail (1280×720) ── */}
      <div
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: THUMB_W, height: THUMB_H,
          overflow: 'hidden', pointerEvents: 'none',
        }}
      >
        <div ref={podcastThumbnailRef} style={{ width: THUMB_W, height: THUMB_H }}>
          <PodcastThumbnail theme={resolvedTheme} imageCache={imageCache} podcastMeta={podcastMeta} />
        </div>
      </div>

      {/* ── Export overlay (slides/stories only — NOT podcast) ── */}
      {exportH.exporting && (
        <div className="fixed inset-0 z-[60] bg-neutral-950/90 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader2 size={48} className="animate-spin mb-4 text-violet-400" />
          <h2 className="text-lg font-bold text-white">{exportH.exportStatusMsg || 'Rendering...'}</h2>
          <p className="text-sm text-white/40 mt-1">
            {exportH.exportProgress.total > 1
              ? `${exportH.exportProgress.current} of ${exportH.exportProgress.total}`
              : exportH.exportProgress.current > 1
                ? `${exportH.exportProgress.current}%`
                : ''}
          </p>
        </div>
      )}

      {/* ── Floating podcast export toast (non-blocking) ── */}
      {exportH.podcastExporting && (
        <div className="fixed bottom-6 right-6 z-[55] w-72 bg-neutral-900 border border-white/[0.1] rounded-xl shadow-2xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-violet-400" />
              <span className="text-xs font-semibold text-white/80">{exportH.podcastStatusMsg || 'Exporting...'}</span>
            </div>
            <button
              onClick={exportH.cancelPodcastExport}
              className="p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              title="Cancel export"
            >
              <X size={12} />
            </button>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-[width] duration-500"
              style={{ width: `${exportH.podcastProgress}%` }}
            />
          </div>
          <div className="text-[10px] text-white/25 mt-1.5 text-right">{exportH.podcastProgress}%</div>
        </div>
      )}

      {/* ── Keyboard Shortcuts Modal ── */}
      {shortcutsOpen && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/60 glass-light" onClick={() => setShortcutsOpen(false)} />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-surface-100 border border-border rounded-aspect shadow-2xl w-full max-w-sm pointer-events-auto animate-fade-in">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-fg-contrast">Keyboard Shortcuts</h3>
                <button onClick={() => setShortcutsOpen(false)} className="p-1 rounded-aspect-sm text-fg-muted hover:text-fg-contrast hover:bg-surface-200 transition-colors"><X size={16} /></button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  ['←  /  →', 'Navigate slides'],
                  ['Alt + ←  /  →', 'Reorder slide'],
                  ['Ctrl + Z', 'Undo'],
                  ['Ctrl + Shift + Z', 'Redo'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-fg">{desc}</span>
                    <kbd className="text-[10px] font-mono text-fg-secondary bg-surface-200 border border-border px-2 py-1 rounded">{key}</kbd>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border">
                <p className="text-[10px] text-fg-muted">Shortcuts are disabled when a text input is focused.</p>
              </div>
            </div>
          </div>
        </>
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
