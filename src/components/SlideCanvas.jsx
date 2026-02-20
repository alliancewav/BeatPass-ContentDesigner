import React, { useState, useEffect, useRef } from 'react';
import { Clock, ArrowRight, Globe, Play, Music } from 'lucide-react';
import CONFIG from '../config';
import { computeLayout } from '../lib/layoutEngine';

// ── Layout Constants ──
// Derived from layoutEngine pixel-budget math.
const L = {
  side: 72,          // horizontal padding
  headerTop: 44,     // header bar y offset
  contentTop: 160,   // TOP_CHROME from layoutEngine
  bottomPad: 120,    // BOT_CHROME from layoutEngine
  progressH: 6,      // progress line height
  progressBot: 40,   // progress line from bottom edge
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

  // Parallax position for image slides — controls vertical (Y) focus point
  const parallaxPos = slide.parallaxPosition != null
    ? `center ${slide.parallaxPosition * 100}%`
    : 'center 40%';

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
        </div>
      )}
      {/* Readability gradient for image slides — rendered in overlay mode too so
         the PNG sent to ffmpeg includes it (matches the live preview). */}
      {isImageSlide && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: typeof theme.overlayGradient === 'function'
            ? theme.overlayGradient(theme.bg)
            : `linear-gradient(to top, ${theme.bg} 10%, ${theme.bg}E6 40%, ${theme.bg}66 65%, transparent 100%)`,
        }} />
      )}

      {/* ── Futuristic bg decorations (content slides only) ── */}
      {slide.type === 'content' && !isImageSlide && !overlayOnly && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            backgroundImage: `radial-gradient(${theme.text}07 1.5px, transparent 1.5px)`,
            backgroundSize: '56px 56px' }} />
          <div style={{ position: 'absolute', bottom: -200, right: -160, zIndex: 5, pointerEvents: 'none',
            width: 900, height: 900, borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.accent}10 0%, transparent 65%)` }} />
          {/* Thin gradient accent line at top edge */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            zIndex: 3, pointerEvents: 'none',
            background: `linear-gradient(90deg, transparent 0%, ${theme.accent}60 30%, ${theme.accent}80 50%, ${theme.accent}60 70%, transparent 100%)` }} />
        </>
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
              {/* Overlay: use theme.overlayGradient for both light and dark so per-theme opacity is respected */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 2,
                background: theme.overlayGradient
                  ? theme.overlayGradient(theme.bg)
                  : `linear-gradient(to top, ${theme.bg} 15%, ${theme.bg}E6 45%, transparent 100%)`,
              }} />
            </div>
          )}
          <div style={{
            position: 'relative', zIndex: 10, flex: 1,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            padding: `0 ${L.side}px ${L.bottomPad + 40}px`,
          }}>
            {/* Dot grid decoration when no cover image */}
          {/* Corner bracket decoration — always visible */}
          <div style={{ position: 'absolute', bottom: L.bottomPad + 20, right: L.side - 16,
            width: 38, height: 38, zIndex: 2, pointerEvents: 'none',
            borderRight: `2px solid ${theme.accent}30`, borderBottom: `2px solid ${theme.accent}30` }} />
          {!imageCache.cover && (
            <>
              <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
                backgroundImage: `radial-gradient(${theme.text}07 1.5px, transparent 1.5px)`,
                backgroundSize: '56px 56px' }} />
              <div style={{ position: 'absolute', top: -80, left: -80, zIndex: 0, pointerEvents: 'none',
                width: 500, height: 500, borderRadius: '50%',
                background: `radial-gradient(circle, ${theme.accent}1A 0%, transparent 65%)` }} />
              {/* Large monogram initial — bottom-right watermark */}
              {(slide.title || '').trim().charAt(0) && (
                <div style={{ position: 'absolute', bottom: -60, right: -40, zIndex: 0, pointerEvents: 'none',
                  fontSize: isPortrait ? 600 : 520, fontWeight: 900, lineHeight: 1,
                  fontFamily: headingFont, color: theme.text, opacity: 0.025,
                  userSelect: 'none', letterSpacing: '-0.05em' }}>
                  {(slide.title || '').trim().charAt(0).toUpperCase()}
                </div>
              )}
            </>
          )}
          <div className="animate-accent-pulse" style={{ width: 80, height: 5, borderRadius: 9999, backgroundColor: theme.accent,
            boxShadow: `0 0 18px ${theme.accent}90`, marginBottom: 28 }} />
            <h1 style={{
              fontFamily: headingFont,
              fontSize: getCoverTitleFontSize((slide.title || '').length, isPortrait),
              fontWeight: 800, lineHeight: 1.05,
              margin: 0, marginBottom: slide.beatCover ? 16 : 28,
              textShadow: usesDarkBackground ? '0 4px 24px rgba(0,0,0,0.35)' : '0 2px 16px rgba(0,0,0,0.12)',
            }}>
              {slide.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {slide.subtitle && (() => {
                const raw = slide.subtitle || '';
                const label = raw.length > 40 ? raw.substring(0, 37) + '…' : raw;
                const pillFont = raw.length > 24 ? 22 : raw.length > 16 ? 25 : 28;
                return (
                  <span style={{
                    backgroundColor: `${theme.accent}22`, color: theme.accent,
                    borderRadius: 9999, padding: '10px 24px',
                    fontSize: pillFont, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    border: `1px solid ${theme.accent}45`,
                    boxShadow: `0 0 14px ${theme.accent}30`,
                    maxWidth: isPortrait ? 800 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </span>
                );
              })()}
              {slide.readingTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.muted }}>
                  {!slide.beatCover && <Clock size={30} strokeWidth={2} />}
                  {slide.beatCover && <Music size={26} strokeWidth={2} />}
                  <span style={{ fontSize: 28, fontWeight: 500 }}>{slide.readingTime}</span>
                </div>
              )}
            </div>
            {/* Author / published date meta row */}
            {(slide.primaryAuthor || slide.publishedAt) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                {slide.primaryAuthor && (
                  <span style={{ fontSize: 26, fontWeight: 500, color: theme.muted, opacity: 0.65 }}>
                    by {slide.primaryAuthor}
                  </span>
                )}
                {slide.primaryAuthor && slide.publishedAt && (
                  <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: theme.muted, opacity: 0.3, flexShrink: 0, display: 'inline-block' }} />
                )}
                {slide.publishedAt && (() => { const d = new Date(slide.publishedAt); return !isNaN(d.getTime()) ? (
                  <span style={{ fontSize: 24, color: theme.muted, opacity: 0.45 }}>
                    {d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                ) : null; })()}
              </div>
            )}
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
              fontFamily: "'JetBrains Mono', 'DejaVu Sans Mono', monospace",
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
      {slide.type === 'content' && isImageSlide && (() => {
        const lo = computeLayout(slide, isPortrait);
        const hasBullets = slide.bullets && slide.bullets.length > 0;
        return (
          <div style={{
            position: 'relative', zIndex: 10, flex: 1,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            padding: `${lo.padTop}px ${L.side}px ${lo.padBottom}px`,
            boxSizing: 'border-box', height: '100%',
            overflow: 'hidden',
          }}>
            {/* Top accent line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, pointerEvents: 'none',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0.4) 70%, transparent 100%)' }} />
            <h2 style={{
              fontFamily: headingFont,
              fontSize: lo.titleFontSize,
              fontWeight: 700, lineHeight: lo.titleLineHeight,
              margin: 0, marginBottom: 0,
              position: 'relative', zIndex: 10,
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
              color: '#FFFFFF',
            }}>
              {slide.title}
            </h2>

            <div style={{
              width: 56, height: lo.accentBarH, borderRadius: 9999,
              backgroundColor: theme.accent,
              boxShadow: `0 0 14px ${theme.accent}80`,
              marginTop: lo.accentMarginTop, marginBottom: lo.accentMarginBottom,
              position: 'relative', zIndex: 10,
            }} />

            {slide.content && slide.content.length > 0 && (
              <p style={{
                fontSize: hasBullets ? lo.introFontSize : lo.bodyFontSize,
                fontWeight: 400, lineHeight: hasBullets ? lo.introLineHeight : lo.bodyLineHeight,
                color: 'rgba(255,255,255,0.85)', margin: 0,
                marginBottom: hasBullets ? lo.introMarginBottom : 0,
                position: 'relative', zIndex: 10,
                textShadow: '0 1px 8px rgba(0,0,0,0.4)',
              }}>
                {slide.content}
              </p>
            )}

            {renderBullets({
              bullets: slide.bullets, dotColor: '#FFFFFF',
              textColor: 'rgba(255,255,255,0.85)', textShadow: '0 1px 8px rgba(0,0,0,0.4)',
              fontSize: lo.bulletFontSize, lineHeight: lo.bulletLineHeight,
              gap: lo.bulletGap, dotSize: lo.bulletDotSize,
            })}

            {slide.imageCaption && (
              <div style={{
                position: 'relative', zIndex: 11, alignSelf: 'flex-start', marginTop: 12,
                backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
                borderRadius: 8, padding: '6px 14px',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <span style={{
                  fontSize: 22, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic',
                  letterSpacing: '0.01em', lineHeight: 1.3,
                }}>
                  {slide.imageCaption}
                </span>
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
              background: `linear-gradient(to top, ${theme.bg} 30%, transparent 100%)`,
              pointerEvents: 'none', zIndex: 15,
            }} />
          </div>
        );
      })()}

      {/* ── CTA / Outro Slide ── */}
      {slide.type === 'cta' && (
        <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* CTA brand decorations */}
          {!imageCache.cover && (
            <>
              <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
                backgroundImage: `radial-gradient(${theme.text}07 1.5px, transparent 1.5px)`,
                backgroundSize: '56px 56px' }} />
              <div style={{ position: 'absolute', top: -100, right: -100, zIndex: 1, pointerEvents: 'none',
                width: 500, height: 500, borderRadius: '50%',
                background: `radial-gradient(circle, ${theme.accent}1A 0%, transparent 65%)` }} />
            </>
          )}
          <div style={{ position: 'absolute', bottom: 50, right: L.side - 16,
            width: 38, height: 38, zIndex: 3, pointerEvents: 'none',
            borderRight: `2px solid ${theme.accent}30`, borderBottom: `2px solid ${theme.accent}30` }} />
          {/* Top accent line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, pointerEvents: 'none',
            background: `linear-gradient(90deg, transparent 0%, ${theme.accent}60 30%, ${theme.accent}80 50%, ${theme.accent}60 70%, transparent 100%)` }} />
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
                boxShadow: `0 0 80px ${theme.accentBg}60, 0 0 0 1px ${theme.accentBg}50`,
              }}>
                <ArrowRight size={72} strokeWidth={2.5} />
              </div>
            </div>
            <h2 style={{
              fontFamily: headingFont,
              fontSize: isPortrait ? 96 : 80, fontWeight: 800,
              lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '-0.02em',
              margin: 0, marginBottom: 24, whiteSpace: 'pre-line',
            }}>
              {slide.ctaHeading || 'Read Full\nArticle'}
            </h2>
            <div style={{ marginBottom: 36 }}>
              <span style={{
                fontSize: 30, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                borderBottom: `3px solid ${theme.accent}`, paddingBottom: 6,
                color: theme.accent,
              }}>
                {slide.ctaLabel || 'Link in Bio'}
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: headingFont, fontSize: 28, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '12px 28px', border: `2px solid ${theme.accent}50`, borderRadius: 9999,
              color: theme.accent, opacity: 0.7,
              boxShadow: `0 0 14px ${theme.accent}25`,
            }}>
              <Globe size={24} style={{ marginRight: 10 }} />
              <span>{slide.subtitle || CONFIG.brand.domain}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Segmented Progress Indicator ── */}
      <div style={{
        position: 'absolute', bottom: L.progressBot, left: L.side, right: L.side,
        display: 'flex', gap: isPortrait ? 4 : 3, alignItems: 'center', zIndex: 30,
      }}>
        {Array.from({ length: totalSlides }).map((_, i) => {
          const isActive = i === index;
          const isPast = i < index;
          return (
            <div key={i} style={{
              flex: isActive ? 2.5 : 1, height: isActive ? 6 : 4, borderRadius: 9999,
              backgroundColor: isActive ? theme.accent : isPast ? `${theme.accent}70` : (usesDarkBackground ? 'rgba(255,255,255,0.18)' : `${theme.text}18`),
              boxShadow: isActive ? `0 0 10px ${theme.accent}CC` : 'none',
              transition: 'flex 0.3s ease, background-color 0.2s',
            }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Content body renderer — pixel-budget-driven layout ──
function renderContentBody({ slide, isPortrait, hasVideoEmbed, L, theme, headingFont }) {
  const lo = computeLayout(slide, isPortrait);
  const contentLen = (slide.content || '').length;
  const bulletCount = (slide.bullets || []).length;
  const hasBoth = contentLen > 0 && bulletCount > 0;

  // Vertical alignment: center on portrait when content is sparse
  const justify = hasVideoEmbed ? 'flex-end'
    : lo.verticalAlign === 'center' ? 'center'
    : 'flex-start';

  // ── Continuation layout: section pill + content/bullets ──
  if (slide.isContinuation && !slide.subtype) {
    const isSparse = !slide.content && bulletCount <= 2;
    const sparseFontBoost = isSparse ? 6 : 0;
    return (
      <div style={{
        position: 'relative', zIndex: 10, flex: 1,
        display: 'flex', flexDirection: 'column',
        justifyContent: isSparse ? 'center' : 'flex-start',
        padding: `${lo.padTop}px ${L.side}px ${lo.padBottom}px`,
        boxSizing: 'border-box', height: '100%', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: isPortrait ? 220 : 160, right: L.side - 10,
          fontSize: isPortrait ? 320 : 260, fontWeight: 900, lineHeight: 1,
          color: theme.text, opacity: 0.04, userSelect: 'none', pointerEvents: 'none', zIndex: 0,
          fontFamily: headingFont }}>
          {String(slide.number || '').padStart(2, '0')}
        </div>
        {/* Section context pill */}
        {(() => {
          const raw = slide.title || '';
          const pillTitle = raw.length > 38 ? raw.substring(0, 35) + '…' : raw;
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10,
              backgroundColor: `${theme.accent}18`, border: `1px solid ${theme.accent}35`,
              borderRadius: 9999, padding: isPortrait ? '8px 22px' : '6px 16px',
              marginBottom: lo.accentMarginBottom, alignSelf: 'flex-start',
              position: 'relative', zIndex: 10, whiteSpace: 'nowrap', maxWidth: '100%',
              overflow: 'hidden' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.accent,
                boxShadow: `0 0 8px ${theme.accent}`, flexShrink: 0 }} />
              <span style={{ fontFamily: headingFont, fontSize: Math.round(lo.titleFontSize * 0.48),
                fontWeight: 600, lineHeight: 1.2, color: theme.accent, opacity: 0.9,
                letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pillTitle}
              </span>
            </div>
          );
        })()}
        {/* On sparse slides, show a prominent section title for visual weight */}
        {isSparse && (
          <div style={{ position: 'relative', zIndex: 10, marginBottom: 28 }}>
            <h2 style={{ fontFamily: headingFont, fontSize: Math.round(lo.titleFontSize * 0.72),
              fontWeight: 700, lineHeight: 1.1, color: theme.text, margin: 0, marginBottom: 20,
              letterSpacing: '-0.01em' }}>
              {slide.title}
            </h2>
            <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: theme.accent,
              boxShadow: `0 0 10px ${theme.accent}80` }} />
          </div>
        )}
        {/* H3 sub-heading label (strategy C slides) */}
        {slide.subHeadingLabel && !isSparse && (
          <div style={{ position: 'relative', zIndex: 10, marginBottom: 16 }}>
            <span style={{
              fontFamily: headingFont, fontSize: Math.round(lo.titleFontSize * 0.54),
              fontWeight: 700, color: theme.accent, opacity: 0.85, letterSpacing: '0.01em',
            }}>
              {slide.subHeadingLabel}
            </span>
          </div>
        )}
        {slide.content && (
          <div style={{ position: 'relative', zIndex: 10, marginBottom: bulletCount > 0 ? lo.introMarginBottom : 0 }}>
            <p style={{ fontSize: hasBoth ? lo.introFontSize : lo.bodyFontSize, fontWeight: 400,
              lineHeight: hasBoth ? lo.introLineHeight : lo.bodyLineHeight,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: theme.text, opacity: 0.88, margin: 0 }}>
              {slide.content}
            </p>
          </div>
        )}
        {renderBullets({ bullets: slide.bullets, dotColor: theme.accent, textColor: theme.text,
          fontSize: lo.bulletFontSize + sparseFontBoost, lineHeight: lo.bulletLineHeight,
          gap: lo.bulletGap, dotSize: lo.bulletDotSize })}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
          background: `linear-gradient(to top, ${theme.bg} 30%, transparent 100%)`,
          pointerEvents: 'none', zIndex: 15 }} />
      </div>
    );
  }

  // ── Table slide layout ──
  if (slide.subtype === 'table' && slide.tableData) {
    const { headers, rows } = slide.tableData;
    const colCount = Math.max(headers.length, rows[0]?.length || 0);
    const visibleRows = rows; // splitting handled in slideGenerator
    const fso = slide.fontSizeOverride || 0;
    const cellFont = (colCount <= 2 ? 38 : colCount <= 3 ? 32 : colCount <= 4 ? 28 : 24) + fso;
    const headerFont = cellFont + 2;
    const colW = `${(100 / Math.max(colCount, 1)).toFixed(1)}%`;
    return (
      <div style={{
        position: 'relative', zIndex: 10, flex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        padding: `${lo.padTop}px ${L.side}px ${lo.padBottom}px`,
        boxSizing: 'border-box', height: '100%', overflow: 'hidden',
      }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent 0%, ${theme.accent}50 30%, ${theme.accent}70 50%, ${theme.accent}50 70%, transparent 100%)` }} />
        <h2 style={{ fontFamily: headingFont, fontSize: lo.titleFontSize, fontWeight: 700,
          lineHeight: lo.titleLineHeight, margin: 0, marginBottom: 0, position: 'relative', zIndex: 10 }}>
          {slide.title}
        </h2>
        {/* Accent bar with glow */}
        <div style={{ width: 56, height: lo.accentBarH, borderRadius: 9999,
          backgroundColor: theme.accent, marginTop: lo.accentMarginTop, marginBottom: lo.accentMarginBottom,
          boxShadow: `0 0 14px ${theme.accent}80`, position: 'relative', zIndex: 10 }} />
        {/* Terminal-style table panel */}
        <div style={{ position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          borderRadius: isPortrait ? 18 : 14, overflow: 'hidden',
          border: `1.5px solid ${theme.accent}55`,
          boxShadow: `0 0 0 1px ${theme.accent}10, 0 6px 40px ${theme.accent}20, 0 2px 10px rgba(0,0,0,0.5)`,
          background: `linear-gradient(145deg, ${theme.text}07 0%, ${theme.text}03 100%)` }}>
          {/* Terminal header bar */}
          <div style={{ display: 'flex', alignItems: 'center', height: isPortrait ? 48 : 38, flexShrink: 0,
            padding: `0 ${isPortrait ? 20 : 16}px`, gap: isPortrait ? 9 : 7,
            background: `linear-gradient(90deg, ${theme.accent}22 0%, ${theme.accent}08 60%, transparent 100%)`,
            borderBottom: `1px solid ${theme.accent}30` }}>
            {[0.95, 0.5, 0.22].map((op, i) => (
              <div key={i} style={{ width: isPortrait ? 12 : 9, height: isPortrait ? 12 : 9,
                borderRadius: '50%', backgroundColor: theme.accent, opacity: op, flexShrink: 0,
                boxShadow: i === 0 ? `0 0 10px ${theme.accent}CC` : 'none' }} />
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: headingFont, fontSize: isPortrait ? 17 : 13,
              letterSpacing: '0.14em', color: theme.accent, opacity: 0.6 }}>
              ▦&nbsp;&nbsp;{colCount} COLUMNS
            </span>
          </div>
          {/* Column header row */}
          {headers.length > 0 && (
            <div style={{ display: 'flex', flexShrink: 0,
              background: `linear-gradient(90deg, ${theme.accent}30 0%, ${theme.accent}18 100%)`,
              borderBottom: `1px solid ${theme.accent}30` }}>
              {headers.map((h, i) => (
                <div key={i} style={{ width: colW, flexShrink: 0, padding: `${isPortrait ? 10 : 8}px ${isPortrait ? 14 : 10}px`,
                  fontSize: headerFont, fontWeight: 700, lineHeight: 1.2,
                  color: theme.accent, fontFamily: headingFont, letterSpacing: '0.04em',
                  borderRight: i < headers.length - 1 ? `1px solid ${theme.accent}25` : 'none',
                  wordBreak: 'break-word' }}>
                  {h}
                </div>
              ))}
            </div>
          )}
          {/* Data rows */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {visibleRows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex',
                backgroundColor: ri % 2 === 0 ? `${theme.text}06` : 'transparent',
                borderBottom: ri < visibleRows.length - 1 ? `1px solid ${theme.accent}12` : 'none' }}>
                {Array.from({ length: colCount }).map((_, ci) => (
                  <div key={ci} style={{ width: colW, flexShrink: 0,
                    padding: `${isPortrait ? 10 : 8}px ${isPortrait ? 14 : 10}px`,
                    fontSize: cellFont, fontWeight: ci === 0 ? 700 : 400, lineHeight: 1.35,
                    color: ci === 0 ? theme.text : theme.muted,
                    borderRight: ci < colCount - 1 ? `1px solid ${theme.accent}15` : 'none',
                    wordBreak: 'break-word' }}>
                    {row[ci] || '—'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Callout / pull-quote slide layout ──
  if (slide.subtype === 'callout') {
    const hasEmoji = !!(slide.calloutEmoji);
    const rawTitle = slide.title || '';
    const pillTitle = rawTitle.length > 38 ? rawTitle.substring(0, 35) + '…' : rawTitle;
    const hasPill = rawTitle.length > 2;
    return (
      <div style={{
        position: 'relative', zIndex: 10, flex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: hasPill ? 'flex-start' : 'center',
        padding: `${lo.padTop}px ${L.side}px ${lo.padBottom}px`,
        boxSizing: 'border-box', height: '100%', overflow: 'hidden',
      }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent 0%, ${theme.accent}50 30%, ${theme.accent}70 50%, ${theme.accent}50 70%, transparent 100%)` }} />
        {/* Accent pill badge — only when title is present */}
        {hasPill && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10,
            backgroundColor: `${theme.accent}18`, border: `1px solid ${theme.accent}35`,
            borderRadius: 9999, padding: isPortrait ? '8px 22px' : '6px 16px',
            marginBottom: lo.accentMarginBottom, alignSelf: 'flex-start',
            position: 'relative', zIndex: 10, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.accent,
              boxShadow: `0 0 8px ${theme.accent}`, flexShrink: 0 }} />
            <span style={{ fontFamily: headingFont, fontSize: Math.round(lo.titleFontSize * 0.48),
              fontWeight: 600, lineHeight: 1.2, color: theme.accent, opacity: 0.9,
              letterSpacing: '0.02em' }}>
              {pillTitle}
            </span>
          </div>
        )}
        {/* Callout box with glow */}
        <div style={{
          position: 'relative', zIndex: 10, flex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          borderLeft: `6px solid ${theme.accent}`,
          backgroundColor: `${theme.accent}10`,
          borderRadius: '0 16px 16px 0',
          boxShadow: `inset 0 0 40px ${theme.accent}08, -2px 0 20px ${theme.accent}30`,
          padding: `${isPortrait ? 48 : 36}px ${isPortrait ? 48 : 40}px`,
        }}>
          {slide.calloutIsQuote ? (
            <div style={{ fontSize: isPortrait ? 180 : 140, lineHeight: 0.7, marginBottom: isPortrait ? 20 : 16,
              color: theme.accent, opacity: 0.35, fontFamily: 'Georgia, serif', userSelect: 'none' }}>
              &#8220;
            </div>
          ) : hasEmoji ? (
            <div style={{ fontSize: isPortrait ? 80 : 64, lineHeight: 1, marginBottom: 24 }}>
              {slide.calloutEmoji}
            </div>
          ) : null}
          {(() => {
            const qText = slide.calloutText || slide.content || '';
            const qLen = qText.length;
            // Pull-quote: scale font up for shorter, punchier quotes
            const quoteFontSize = slide.calloutIsQuote
              ? (isPortrait
                ? (qLen < 60 ? 62 : qLen < 120 ? 52 : qLen < 200 ? 44 : 38)
                : (qLen < 60 ? 52 : qLen < 120 ? 44 : qLen < 200 ? 38 : 32))
              : (isPortrait ? 42 : 36);
            return (
              <p style={{
                fontSize: quoteFontSize,
                fontWeight: 500,
                fontStyle: slide.calloutIsQuote ? 'italic' : 'normal',
                lineHeight: slide.calloutIsQuote ? 1.4 : 1.5,
                color: theme.text, margin: 0,
                wordBreak: 'break-word',
                letterSpacing: slide.calloutIsQuote ? '-0.01em' : '0',
              }}>
                {qText}
              </p>
            );
          })()}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
          background: `linear-gradient(to top, ${theme.bg} 30%, transparent 100%)`,
          pointerEvents: 'none', zIndex: 15 }} />
      </div>
    );
  }

  // ── Code block slide layout ── (futuristic terminal)
  if (slide.subtype === 'code') {
    const codeLines = (slide.content || '').split('\n').filter(l => l.trim().length > 0);
    const fso = slide.fontSizeOverride || 0;
    const fontSize = (isPortrait
      ? (codeLines.length <= 2 ? 44 : codeLines.length <= 3 ? 38 : codeLines.length <= 5 ? 32 : 26)
      : (codeLines.length <= 2 ? 36 : codeLines.length <= 3 ? 32 : codeLines.length <= 5 ? 26 : 22)) + fso;
    const numFontSize = Math.round(fontSize * 0.68);
    const gutterW = isPortrait ? 56 : 44;
    const hasCaption = !!slide.codeCaption;
    const hasSubtitle = !!slide.codeSubtitle;
    const mainHeading = slide.codeSubtitle || slide.title;
    const headerH = isPortrait ? 44 : 36;
    return (
      <div style={{
        position: 'relative', zIndex: 10, flex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        padding: `${lo.padTop}px ${L.side}px ${lo.padBottom}px`,
        boxSizing: 'border-box', height: '100%', overflow: 'hidden',
      }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent 0%, ${theme.accent}50 30%, ${theme.accent}70 50%, ${theme.accent}50 70%, transparent 100%)` }} />
        {/* Muted section label — only when codeSubtitle set */}
        {hasSubtitle && !hasCaption && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14,
            marginBottom: lo.accentMarginBottom, position: 'relative', zIndex: 10 }}>
            <div style={{ width: 28, height: 3, borderRadius: 9999, backgroundColor: theme.accent, flexShrink: 0 }} />
            <span style={{ fontFamily: headingFont, fontSize: Math.round(lo.titleFontSize * 0.55),
              fontWeight: 700, lineHeight: 1.25, color: theme.text, opacity: 0.4 }}>
              {slide.title}
            </span>
          </div>
        )}
        {/* Main heading */}
        <h2 style={{ fontFamily: headingFont, fontSize: lo.titleFontSize, fontWeight: 700,
          lineHeight: lo.titleLineHeight, margin: 0, position: 'relative', zIndex: 10 }}>
          {mainHeading}
        </h2>
        {/* Accent bar */}
        <div style={{ width: 56, height: lo.accentBarH, borderRadius: 9999,
          backgroundColor: theme.accent,
          marginTop: lo.accentMarginTop,
          marginBottom: hasCaption ? 12 : lo.accentMarginBottom,
          boxShadow: `0 0 14px ${theme.accent}80`,
          position: 'relative', zIndex: 10 }} />
        {/* Caption */}
        {hasCaption && (
          <p style={{
            fontFamily: headingFont, fontSize: Math.round(lo.titleFontSize * 0.52),
            fontWeight: 400, lineHeight: 1.4, color: theme.muted, opacity: 0.8,
            margin: 0, marginBottom: 16, position: 'relative', zIndex: 10, wordBreak: 'break-word',
          }}>
            {slide.codeCaption}
          </p>
        )}
        {/* ── Terminal panel ── */}
        <div style={{ position: 'relative', zIndex: 10, flex: 1, minHeight: 0 }}>
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            borderRadius: isPortrait ? 18 : 14,
            overflow: 'hidden',
            border: `1.5px solid ${theme.accent}55`,
            boxShadow: `0 0 0 1px ${theme.accent}10, 0 6px 40px ${theme.accent}25, 0 2px 10px rgba(0,0,0,0.5)`,
            background: `linear-gradient(145deg, ${theme.text}07 0%, ${theme.text}03 100%)`,
          }}>
            {/* Terminal header bar */}
            <div style={{
              display: 'flex', alignItems: 'center',
              height: headerH, flexShrink: 0,
              padding: `0 ${isPortrait ? 22 : 16}px`,
              gap: isPortrait ? 10 : 8,
              background: `linear-gradient(90deg, ${theme.accent}22 0%, ${theme.accent}08 60%, transparent 100%)`,
              borderBottom: `1px solid ${theme.accent}30`,
            }}>
              {/* Three dots — accent glow → dim */}
              {[0.95, 0.5, 0.22].map((op, i) => (
                <div key={i} style={{
                  width: isPortrait ? 12 : 9, height: isPortrait ? 12 : 9,
                  borderRadius: '50%', backgroundColor: theme.accent, opacity: op,
                  boxShadow: i === 0 ? `0 0 10px ${theme.accent}CC` : 'none',
                  flexShrink: 0,
                }} />
              ))}
              <div style={{ flex: 1 }} />
              {/* Header label */}
              <span style={{
                fontFamily: headingFont, fontSize: isPortrait ? 18 : 14,
                letterSpacing: '0.14em', color: theme.accent, opacity: 0.6,
              }}>
                {'</>'}&nbsp;&nbsp;EXAMPLE
              </span>
            </div>
            {/* Code body */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              justifyContent: 'center', overflow: 'hidden',
              padding: `${isPortrait ? 20 : 14}px 0`,
            }}>
              {codeLines.map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline' }}>
                  {/* Line number gutter */}
                  <div style={{
                    width: gutterW, flexShrink: 0, textAlign: 'right',
                    paddingRight: isPortrait ? 16 : 12,
                    fontFamily: headingFont, fontSize: numFontSize, fontWeight: 400,
                    color: theme.accent, opacity: 0.4, lineHeight: 1.75,
                    borderRight: `1.5px solid ${theme.accent}20`,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  {/* Code text */}
                  <div style={{
                    flex: 1,
                    paddingLeft: isPortrait ? 16 : 12,
                    paddingRight: isPortrait ? 18 : 14,
                    fontFamily: headingFont, fontSize, fontWeight: 400,
                    lineHeight: 1.75, color: theme.text,
                    wordBreak: 'break-word',
                  }}>
                    {line}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Standard content layout ──
  return (
    <div style={{
      position: 'relative', zIndex: 10, flex: 1,
      display: 'flex', flexDirection: 'column',
      justifyContent: justify,
      padding: `${lo.padTop}px ${L.side}px ${lo.padBottom}px`,
      boxSizing: 'border-box', height: '100%',
      overflow: 'hidden',
    }}>
      {/* Subtle large section number watermark */}
      <div style={{
        position: 'absolute', top: isPortrait ? 220 : 160, right: L.side - 10,
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
        fontSize: lo.titleFontSize,
        fontWeight: 700, lineHeight: lo.titleLineHeight,
        margin: 0, marginBottom: 0,
        position: 'relative', zIndex: 10,
      }}>
        {slide.title}
      </h2>

      {/* Accent divider bar — visual hierarchy between title and body */}
      <div style={{
        width: 56, height: lo.accentBarH, borderRadius: 9999,
        backgroundColor: theme.accent,
        boxShadow: `0 0 14px ${theme.accent}80`,
        marginTop: lo.accentMarginTop, marginBottom: lo.accentMarginBottom,
        position: 'relative', zIndex: 10,
      }} />

      {/* H3 sub-heading label (strategy C slides) */}
      {slide.subHeadingLabel && (
        <div style={{ position: 'relative', zIndex: 10, marginBottom: 18 }}>
          <span style={{
            display: 'inline-block',
            fontFamily: headingFont, fontSize: Math.round(lo.titleFontSize * 0.54),
            fontWeight: 700, color: theme.accent, opacity: 0.85,
            letterSpacing: '0.01em', lineHeight: 1.2,
          }}>
            {slide.subHeadingLabel}
          </span>
        </div>
      )}

      {/* Body text */}
      {slide.content && (
        <div style={{ position: 'relative', zIndex: 10, marginBottom: bulletCount > 0 ? lo.introMarginBottom : 0 }}>
          <p style={{
            fontSize: hasBoth ? lo.introFontSize : lo.bodyFontSize,
            fontWeight: 400,
            lineHeight: hasBoth ? lo.introLineHeight : lo.bodyLineHeight,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            color: theme.text, opacity: 0.88, margin: 0,
          }}>
            {slide.content}
          </p>
        </div>
      )}

      {/* Bullet points */}
      {renderBullets({
        bullets: slide.bullets,
        dotColor: theme.accent,
        textColor: theme.text,
        textOpacity: 0.88,
        fontSize: lo.bulletFontSize,
        lineHeight: lo.bulletLineHeight,
        gap: lo.bulletGap,
        dotSize: lo.bulletDotSize,
      })}

      {/* Callout enrichment — inline highlighted note attached to this slide */}
      {slide.calloutText && !slide.subtype && (
        <div style={{
          position: 'relative', zIndex: 10,
          marginTop: 28,
          borderLeft: `5px solid ${theme.accent}`,
          backgroundColor: `${theme.accent}10`,
          borderRadius: '0 16px 16px 0',
          boxShadow: `-2px 0 16px ${theme.accent}30`,
          padding: '16px 20px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
        }}>
          {slide.calloutEmoji && (
            <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>{slide.calloutEmoji}</span>
          )}
          <p style={{ fontSize: lo.introFontSize - 4, fontWeight: 400, lineHeight: 1.4,
            color: theme.muted, margin: 0, wordBreak: 'break-word' }}>
            {slide.calloutText}
          </p>
        </div>
      )}

      {/* Bottom fade for overflow protection */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
        background: `linear-gradient(to top, ${theme.bg} 30%, transparent 100%)`,
        pointerEvents: 'none', zIndex: 15,
      }} />
    </div>
  );
}

// ── Shared bullet list renderer — sizes from layoutEngine ──
function renderBullets({ bullets, dotColor, textColor, textOpacity, textShadow, fontSize = 36, lineHeight = 1.45, gap = 20, dotSize = 12 }) {
  if (!bullets || bullets.length === 0) return null;
  const bulletLineH = fontSize * lineHeight;
  const dotTop = (bulletLineH - dotSize) / 2;
  return (
    <div style={{ position: 'relative', zIndex: 10 }}>
      {bullets.map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 18,
          marginBottom: i < bullets.length - 1 ? gap : 0,
        }}>
          <div style={{
            width: dotSize, height: dotSize, borderRadius: '50%', flexShrink: 0,
            backgroundColor: dotColor, marginTop: dotTop,
            boxShadow: `0 0 ${Math.round(dotSize * 0.8)}px ${dotColor}80`,
          }} />
          <span style={{
            fontSize, fontWeight: 400, lineHeight,
            color: textColor,
            ...(textOpacity !== undefined ? { opacity: textOpacity } : {}),
            ...(textShadow ? { textShadow } : {}),
          }}>
            {b}
          </span>
        </div>
      ))}
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

// Body text font size is now computed by layoutEngine.computeLayout()
