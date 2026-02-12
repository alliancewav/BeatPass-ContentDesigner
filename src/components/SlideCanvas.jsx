import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronRight, Globe, Play, Music } from 'lucide-react';
import CONFIG from '../config';

// ── Layout Constants ──
// Scaled for iPhone readability (1080px canvas → 393pt screen = 0.364×).
const L = {
  side: 72,          // horizontal padding
  headerTop: 44,     // header bar y offset
  contentTop: 210,   // content area starts below header (Instagram top safe: ~250px)
  bottomPad: 260,    // bottom breathing room (Instagram bottom safe: ~280px)
  progressH: 6,      // progress line height
  progressBot: 52,   // progress line from bottom edge
};

export default function SlideCanvas({ slide, index, totalSlides, theme, aspectRatio, imageCache, isExport = false, overlayOnly = false, coverYouTubeId = null, coverMediaMode = 'thumbnail' }) {
  if (!slide) return null;

  const isPortrait = aspectRatio === 'portrait';
  const W = 1080;
  const H = isPortrait ? 1350 : 1080;

  const hasImageBg = slide.type === 'cover' || slide.type === 'cta';
  const isImageSlide = !!(slide.imageSlide && slide.image);

  // Extract YouTube video ID for inline playback
  const ytVideoId = (slide.videoUrl || '').match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1]
    || (slide.videoUrl || '').match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1]
    || null;
  const hasVideoEmbed = !!ytVideoId;
  const hasDarkOverlay = hasImageBg || isImageSlide || hasVideoEmbed;

  // Logo: respect the theme's preferred variant. Cover/CTA slides overlay the bg
  // color over the image, so the logo must match the theme, not the image.
  const usesDarkBackground = theme.logoVariant === 'light'; // 'light' logo = dark bg theme
  const useWhiteLogo = usesDarkBackground;
  const logoSrc = useWhiteLogo ? imageCache.logoWhite : imageCache.logoBlack;
  const headingFont = "'JetBrains Mono', 'Geist', monospace";
  const bodyFont = "'Roboto', 'Geist', system-ui, -apple-system, sans-serif";

  // ── Animated progress bar for player layout ──
  const parseDurationToSec = (dur) => {
    if (!dur) return 180;
    const parts = dur.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 180;
  };
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const pl = slide.playerLayout || null;
  const totalDurSec = pl ? parseDurationToSec(pl.duration) : 180;
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    // Only animate in live preview (not export or overlay capture)
    if (!pl || isExport || overlayOnly) return;
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        return next >= totalDurSec ? 0 : next; // loop
      });
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [slide.id, pl, isExport, overlayOnly, totalDurSec]);

  const progressPct = pl ? Math.min(1, elapsed / totalDurSec) * 100 : 0;
  const elapsedFormatted = pl ? formatTime(elapsed) : '0:00';
  const totalDurFormatted = pl ? (pl.duration || '3:00') : '3:00';

  // Parallax position for image slides
  const parallaxPos = slide.parallaxPosition != null
    ? `${slide.parallaxPosition * 100}% center`
    : 'center center';

  return (
    <div
      id="export-root"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: W,
        height: H,
        backgroundColor: overlayOnly ? 'transparent' : theme.bg,
        color: theme.text,
        backgroundImage: (slide.type === 'content' && !isImageSlide && !overlayOnly) ? theme.gradient : 'none',
        fontFamily: bodyFont,
        lineHeight: 1.2,
      }}
    >
      {/* ── Full-bleed image (ONLY for dedicated image slides) ── */}
      {isImageSlide && !overlayOnly && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <img
            src={slide.image}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              objectPosition: parallaxPos,
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to top, ${theme.bg} 10%, ${theme.bg}E6 40%, ${theme.bg}66 65%, transparent 100%)`,
          }} />
        </div>
      )}

      {/* ── Header Bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%',
        padding: `${L.headerTop}px ${L.side}px 0`,
        zIndex: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={imageCache.favicon} alt="" style={{ width: 56, height: 56, objectFit: 'contain', marginRight: 12, flexShrink: 0 }} />
          <img src={logoSrc} alt="" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div style={{
          backgroundColor: usesDarkBackground ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
          color: usesDarkBackground ? '#FFF' : '#0F0F0F',
          borderRadius: 9999, padding: '12px 24px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          whiteSpace: 'nowrap', flexShrink: 0,
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {index + 1} / {totalSlides}
          </span>
        </div>
      </div>

      {/* ── Cover Slide ── */}
      {slide.type === 'cover' && (
        <>
          {imageCache.cover && !overlayOnly && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              {/* YouTube video autoplay mode on cover */}
              {coverYouTubeId && coverMediaMode === 'video' && !isExport ? (
                <>
                  <img src={imageCache.cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <iframe
                    src={`https://www.youtube.com/embed/${coverYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${coverYouTubeId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&playsinline=1&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                    style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: Math.max(W, H * (16 / 9)) + 200,
                      height: Math.max(H, W * (9 / 16)) + 200,
                      transform: 'translate(-50%, -50%)',
                      border: 'none', pointerEvents: 'none', zIndex: 1,
                    }}
                    allow="autoplay; encrypted-media; accelerometer; gyroscope"
                    referrerPolicy="no-referrer-when-downgrade"
                    loading="lazy"
                  />
                </>
              ) : (
                <img src={imageCache.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
              {/* Overlay: light themes need heavier coverage so dark images don't clash */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 2,
                background: usesDarkBackground
                  ? (theme.overlayGradient ? theme.overlayGradient(theme.bg) : `linear-gradient(to top, ${theme.bg} 15%, ${theme.bg}E6 45%, transparent 100%)`)
                  : `linear-gradient(to top, ${theme.bg} 30%, ${theme.bg}F2 55%, ${theme.bg}CC 75%, ${theme.bg}99 100%)`,
              }} />
            </div>
          )}
          <div style={{
            position: 'relative', zIndex: 10, flex: 1,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            padding: `0 ${L.side}px ${L.bottomPad + 40}px`,
          }}>
            <div style={{ width: 80, height: 5, borderRadius: 9999, backgroundColor: theme.accent, marginBottom: 28 }} />
            <h1 style={{
              fontFamily: headingFont,
              fontSize: getCoverTitleFontSize((slide.title || '').length, isPortrait),
              fontWeight: 800, lineHeight: 1.05,
              margin: 0, marginBottom: slide.beatCover ? 16 : 28,
              textShadow: usesDarkBackground ? '0 4px 24px rgba(0,0,0,0.3)' : '0 2px 12px rgba(255,255,255,0.5)',
            }}>
              {slide.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {slide.subtitle && (
                <span style={{
                  backgroundColor: theme.accentBg, color: theme.accentText,
                  borderRadius: 9999, padding: '10px 24px',
                  fontSize: 28, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {slide.subtitle}
                </span>
              )}
              {slide.readingTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.muted }}>
                  {!slide.beatCover && <Clock size={30} strokeWidth={2} />}
                  {slide.beatCover && <Music size={26} strokeWidth={2} />}
                  <span style={{ fontSize: 28, fontWeight: 500 }}>{slide.readingTime}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── YouTube video background (editor preview) ── */}
      {/* Matches Ghost theme's embed approach: standard youtube.com + minimal params + origin */}
      {hasVideoEmbed && slide.type === 'content' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
          {/* Fallback: YouTube thumbnail (hidden in overlay-only mode for transparent composite) */}
          {!overlayOnly && (
            <img
              src={`https://img.youtube.com/vi/${ytVideoId}/maxresdefault.jpg`}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          {/* YouTube embed — same params as Ghost theme custom.js + autoplay+mute */}
          {/* Skip iframe in export mode — html-to-image can't capture cross-origin iframes */}
          {!isExport && (
            <iframe
              src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&mute=1&loop=1&playlist=${ytVideoId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&playsinline=1&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: Math.max(W, H * (16 / 9)) + 200,
                height: Math.max(H, W * (9 / 16)) + 200,
                transform: 'translate(-50%, -50%)',
                border: 'none', pointerEvents: 'none',
                zIndex: 1,
              }}
              allow="autoplay; encrypted-media; accelerometer; gyroscope"
              referrerPolicy="no-referrer-when-downgrade"
              loading="lazy"
            />
          )}
          {/* Dark overlay for text readability */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            background: `linear-gradient(to top, ${theme.bg} 10%, ${theme.bg}CC 45%, ${theme.bg}88 70%, ${theme.bg}44 100%)`,
          }} />
        </div>
      )}

      {/* ── Content Slide — PLAYER LAYOUT (beat showcase) ── */}
      {slide.type === 'content' && pl && (
        <div style={{
          position: 'relative', zIndex: 10, flex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: `${L.contentTop}px ${L.side}px ${L.bottomPad + 20}px`,
          boxSizing: 'border-box', height: '100%',
          overflow: 'hidden',
        }}>
          {/* Now Playing label */}
          <div style={{
            fontFamily: headingFont,
            fontSize: 28, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: theme.accent, marginBottom: 24,
          }}>
            Now Playing
          </div>

          {/* Beat title */}
          <h2 style={{
            fontFamily: headingFont,
            fontSize: isPortrait ? 100 : 84,
            fontWeight: 800, lineHeight: 1.0,
            margin: 0, marginBottom: 12,
          }}>
            {slide.title}
          </h2>

          {/* Producer */}
          <div style={{
            fontSize: 42, fontWeight: 400, lineHeight: 1.3,
            color: theme.muted, marginBottom: 28,
          }}>
            {pl.producer}
          </div>

          {/* Genre tags + BPM row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            {pl.genres.slice(0, 3).map((g, i) => (
              <span key={i} style={{
                fontSize: 27, fontWeight: 600, letterSpacing: '0.04em',
                padding: '8px 20px', borderRadius: 9999,
                backgroundColor: `${theme.text}12`,
                border: `1.5px solid ${theme.text}22`,
                color: theme.muted,
              }}>
                {g}
              </span>
            ))}
            {pl.bpm && (
              <span style={{
                fontSize: 27, fontWeight: 600, letterSpacing: '0.04em',
                padding: '8px 20px', borderRadius: 9999,
                backgroundColor: `${theme.accent}20`,
                border: `1.5px solid ${theme.accent}40`,
                color: theme.accent,
              }}>
                {pl.bpm} BPM
              </span>
            )}
          </div>

          {/* Player controls — play button + track bar on same row, time labels below */}
          <div>
            {/* Row: play button + track bar (vertically centered) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                backgroundColor: theme.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 20px ${theme.accent}50`,
              }}>
                <Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
              </div>
              <div
                data-progress-track="true"
                style={{
                  flex: 1, height: 6, borderRadius: 9999,
                  backgroundColor: `${theme.text}18`,
                  overflow: 'hidden', position: 'relative',
                }}
              >
                {/* Animated fill — hidden in overlay mode (ffmpeg draws it animated) */}
                {!overlayOnly && (
                  <div style={{
                    width: `${progressPct}%`, height: '100%', borderRadius: 9999,
                    backgroundColor: theme.accent,
                    transition: 'width 0.1s linear',
                  }} />
                )}
              </div>
            </div>
            {/* Time labels — aligned under the track bar (offset by play button width + gap) */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginLeft: 84, marginTop: 10,
              fontSize: 27, fontWeight: 500, color: theme.muted, opacity: 0.5,
              fontFamily: 'monospace',
            }}>
              <span
                data-timer-elapsed="true"
                style={overlayOnly ? { color: 'transparent' } : undefined}
              >{overlayOnly ? '0:00' : elapsedFormatted}</span>
              <span>{totalDurFormatted}</span>
            </div>
          </div>

          {/* Bottom fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: L.bottomPad + 20,
            background: `linear-gradient(to top, ${theme.bg} 40%, transparent 100%)`,
            pointerEvents: 'none', zIndex: 15,
          }} />
        </div>
      )}

      {/* ── Content Slide — TEXT (no background image) ── */}
      {slide.type === 'content' && !isImageSlide && !slide.playerLayout &&
        renderContentBody({ slide, isPortrait, hasVideoEmbed, L, theme, headingFont })
      }

      {/* ── Content Slide — IMAGE (full-bleed with text overlay) ── */}
      {slide.type === 'content' && isImageSlide && (
        <div style={{
          position: 'relative', zIndex: 10, flex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: `${L.contentTop}px ${L.side}px ${L.bottomPad + 20}px`,
          boxSizing: 'border-box', height: '100%',
        }}>
          {/* Title overlay — short, bold */}
          <h2 style={{
            fontFamily: headingFont,
            fontSize: isPortrait ? 100 : 84,
            fontWeight: 700, lineHeight: 1.08,
            margin: 0, position: 'relative', zIndex: 10,
            textShadow: '0 2px 20px rgba(0,0,0,0.5)',
            color: '#FFFFFF',
          }}>
            {slide.title}
          </h2>

          {/* Optional short caption */}
          {slide.content && slide.content.length > 0 && (
            <p style={{
              fontSize: 36, fontWeight: 400, lineHeight: 1.4,
              color: 'rgba(255,255,255,0.8)', margin: 0, marginTop: 16,
              position: 'relative', zIndex: 10,
              textShadow: '0 1px 8px rgba(0,0,0,0.4)',
            }}>
              {slide.content}
            </p>
          )}
        </div>
      )}

      {/* ── CTA / Outro Slide ── */}
      {slide.type === 'cta' && (
        <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {imageCache.cover && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              {/* YouTube video autoplay mode on CTA */}
              {coverYouTubeId && coverMediaMode === 'video' && !isExport ? (
                <>
                  <img src={imageCache.cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: usesDarkBackground ? 0.25 : 0.12, filter: 'blur(6px)', display: 'block' }} />
                  <iframe
                    src={`https://www.youtube.com/embed/${coverYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${coverYouTubeId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&playsinline=1&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                    style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: Math.max(W, H * (16 / 9)) + 200,
                      height: Math.max(H, W * (9 / 16)) + 200,
                      transform: 'translate(-50%, -50%)',
                      border: 'none', pointerEvents: 'none', zIndex: 1,
                      opacity: usesDarkBackground ? 0.25 : 0.12, filter: 'blur(6px)',
                    }}
                    allow="autoplay; encrypted-media; accelerometer; gyroscope"
                    referrerPolicy="no-referrer-when-downgrade"
                    loading="lazy"
                  />
                </>
              ) : (
                <img src={imageCache.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: usesDarkBackground ? 0.25 : 0.12, filter: 'blur(6px)', display: 'block' }} />
              )}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 2,
                background: usesDarkBackground
                  ? `radial-gradient(ellipse at center, ${theme.bg}CC 0%, ${theme.bg} 70%)`
                  : `radial-gradient(ellipse at center, ${theme.bg}E6 0%, ${theme.bg} 60%)`,
              }} />
            </div>
          )}
          <div style={{
            position: 'relative', zIndex: 20, flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: `${L.contentTop}px ${L.side}px ${L.bottomPad + 20}px`,
          }}>
            <div style={{ marginBottom: 40 }}>
              <div style={{
                width: 160, height: 160, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: theme.accentBg, color: theme.accentText,
                boxShadow: `0 0 80px ${theme.accentBg}50`,
              }}>
                <ChevronRight size={80} strokeWidth={2.5} />
              </div>
            </div>
            <h2 style={{
              fontFamily: headingFont,
              fontSize: isPortrait ? 96 : 80, fontWeight: 800,
              lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '-0.02em',
              margin: 0, marginBottom: 24,
            }}>
              Read Full<br />Article
            </h2>
            <div style={{ marginBottom: 36 }}>
              <span style={{
                fontSize: 30, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                borderBottom: `3px solid ${theme.accent}`, paddingBottom: 6,
                color: theme.accent,
              }}>
                Link in Bio
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: headingFont, fontSize: 28, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '12px 28px', border: `2px solid ${theme.accent}60`, borderRadius: 9999,
              color: theme.muted,
            }}>
              <Globe size={24} style={{ marginRight: 10 }} />
              <span>{slide.subtitle || CONFIG.brand.domain}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress Line ── */}
      <div style={{
        position: 'absolute', bottom: L.progressBot, left: L.side, right: L.side,
        height: L.progressH, borderRadius: 9999, zIndex: 30,
        backgroundColor: usesDarkBackground ? 'rgba(255,255,255,0.15)' : `${theme.text}18`,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${((index + 1) / totalSlides) * 100}%`,
          height: '100%', borderRadius: 9999,
          backgroundColor: theme.accent,
        }} />
      </div>
    </div>
  );
}

// ── Content body renderer (extracted from inline IIFE for readability) ──
function renderContentBody({ slide, isPortrait, hasVideoEmbed, L, theme, headingFont }) {
  const contentLen = (slide.content || '').length;
  const bulletCount = (slide.bullets || []).length;
  const hasBoth = contentLen > 0 && bulletCount > 0;
  const isShort = !hasVideoEmbed && !hasBoth && contentLen < 120 && bulletCount <= 2;

  return (
    <div style={{
      position: 'relative', zIndex: 10, flex: 1,
      display: 'flex', flexDirection: 'column',
      justifyContent: hasVideoEmbed ? 'flex-end' : isShort ? 'center' : 'flex-start',
      padding: `${L.contentTop + 40}px ${L.side}px ${L.bottomPad + 20}px`,
      boxSizing: 'border-box', height: '100%',
      overflow: 'hidden',
    }}>
      {/* Subtle large section number watermark */}
      <div style={{
        position: 'absolute', top: isPortrait ? 250 : 180, right: L.side - 10,
        fontSize: isPortrait ? 320 : 260, fontWeight: 900, lineHeight: 1,
        color: theme.text, opacity: 0.04,
        userSelect: 'none', pointerEvents: 'none', zIndex: 0,
        fontFamily: headingFont,
      }}>
        {String(slide.number || '').padStart(2, '0')}
      </div>

      {/* Title */}
      <h2 style={{
        fontFamily: headingFont,
        fontSize: isPortrait ? 90 : 78,
        fontWeight: 700, lineHeight: 1.08,
        margin: 0, marginBottom: (slide.bullets && slide.bullets.length > 0) ? (slide.content ? 20 : 32) : 24,
        position: 'relative', zIndex: 10,
      }}>
        {slide.title}
      </h2>

      {/* Body text (standalone when no bullets) */}
      {slide.content && (
        <div style={{ position: 'relative', zIndex: 10, marginBottom: (slide.bullets && slide.bullets.length > 0) ? 20 : 0 }}>
          <p style={{
            fontSize: (slide.bullets && slide.bullets.length > 0)
              ? 36
              : getContentFontSizePx((slide.content || '').length, isPortrait),
            fontWeight: 400, lineHeight: 1.45,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            color: theme.muted, margin: 0,
          }}>
            {slide.content}
          </p>
        </div>
      )}

      {/* Bullet points */}
      {slide.bullets && slide.bullets.length > 0 && (
        <div style={{ position: 'relative', zIndex: 10 }}>
          {slide.bullets.map((b, i) => {
            const bulletFontSize = 36;
            const bulletLineH = bulletFontSize * 1.4;
            const dotSize = 12;
            const dotTop = (bulletLineH - dotSize) / 2;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 18,
                marginBottom: i < slide.bullets.length - 1 ? 22 : 0,
              }}>
                <div style={{
                  width: dotSize, height: dotSize, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: theme.accent, marginTop: dotTop,
                }} />
                <span style={{
                  fontSize: bulletFontSize, fontWeight: 400, lineHeight: 1.4,
                  color: theme.muted,
                }}>
                  {b}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom fade for overflow protection */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: L.bottomPad + 40,
        background: `linear-gradient(to top, ${theme.bg} 40%, transparent 100%)`,
        pointerEvents: 'none', zIndex: 15,
      }} />
    </div>
  );
}

// Cover title font size — scales down for longer titles
function getCoverTitleFontSize(charCount, isPortrait) {
  if (isPortrait) {
    if (charCount < 25) return 130;
    if (charCount < 40) return 110;
    if (charCount < 60) return 95;
    if (charCount < 80) return 80;
    return 72;
  } else {
    if (charCount < 25) return 110;
    if (charCount < 40) return 95;
    if (charCount < 60) return 80;
    return 72;
  }
}

// Body text font size — Instagram cheatsheet: body 36-60px
function getContentFontSizePx(textLength, isPortrait) {
  if (isPortrait) {
    if (textLength < 60) return 54;
    if (textLength < 100) return 48;
    if (textLength < 150) return 42;
    return 36;
  } else {
    if (textLength < 60) return 50;
    if (textLength < 100) return 44;
    if (textLength < 150) return 38;
    return 36;
  }
}
