// ─── Story Canvas ───
// Renders a single Instagram Story frame at 1080×1920 (9:16).
// Same inline-style approach as SlideCanvas.jsx for html-to-image export compatibility.

import React from 'react';
import {
  ChevronUp, ArrowRight, ArrowDown, Flame, Smartphone,
  Megaphone, Zap, Eye, BookOpen, Lightbulb, Star,
  MessageCircle, Share2, Link2, Sparkles, AlertCircle,
} from 'lucide-react';
import CONFIG from '../config';

const W = 1080;
const H = 1920;

// IG Story safe zones: 250px top (profile name), 250px bottom (reply bar)
const SAFE = {
  top: 250,
  bottom: 250,
  side: 72,
};

// ── Icon map: story frames store icon name strings, we resolve to components here ──
const ICON_MAP = {
  flame: Flame,
  arrowDown: ArrowDown,
  arrowRight: ArrowRight,
  chevronUp: ChevronUp,
  smartphone: Smartphone,
  megaphone: Megaphone,
  zap: Zap,
  eye: Eye,
  bookOpen: BookOpen,
  lightbulb: Lightbulb,
  star: Star,
  messageCircle: MessageCircle,
  share2: Share2,
  link2: Link2,
  sparkles: Sparkles,
  alertCircle: AlertCircle,
};

const resolveIcon = (name, size = 48, style = {}) => {
  const Comp = ICON_MAP[name];
  if (!Comp) return null;
  return <Comp size={size} style={style} />;
};

export default function StoryCanvas({ frame, index, totalFrames, theme, imageCache, coverOverride, coverYouTubeId = null, coverMediaMode = 'thumbnail', isExport = false }) {
  if (!frame) return null;

  // A1: Resolve background image at render time — prefer global coverOverride over baked frame.image
  const resolvedImage = coverOverride || frame.image || null;
  const showVideoEmbed = coverYouTubeId && coverMediaMode === 'video' && !isExport;

  const usesDarkBackground = theme.logoVariant === 'light';
  const logoSrc = usesDarkBackground ? imageCache.logoWhite : imageCache.logoBlack;
  const headingFont = "'JetBrains Mono', 'Geist', monospace";
  const bodyFont = "'Roboto', 'Geist', system-ui, -apple-system, sans-serif";

  // B3: Theme-aware progress bar colors
  const progressActive = usesDarkBackground ? `${theme.text}E6` : `${theme.text}CC`;
  const progressInactive = usesDarkBackground ? `${theme.text}40` : `${theme.text}30`;

  // D4: Extract poll options once
  const pollOptions = frame.pollOptions || ['Yes', 'No'];

  return (
    <div
      style={{
        position: 'relative',
        width: W,
        height: H,
        overflow: 'hidden',
        backgroundColor: theme.bg,
        color: theme.text,
        backgroundImage: theme.gradient,
        fontFamily: bodyFont,
        lineHeight: 1.2,
      }}
    >
      {/* ── Background image / video (if available) ── */}
      {(resolvedImage || showVideoEmbed) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {/* Thumbnail fallback (always rendered for color continuity) */}
          {resolvedImage && (
            <img
              src={resolvedImage}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          {/* YouTube video embed (overlays thumbnail when in video mode) */}
          {showVideoEmbed && (
            <iframe
              src={`https://www.youtube.com/embed/${coverYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${coverYouTubeId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&playsinline=1&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: Math.max(1080, 1920 * (16 / 9)) + 200,
                height: Math.max(1920, 1080 * (9 / 16)) + 200,
                transform: 'translate(-50%, -50%)',
                border: 'none', pointerEvents: 'none', zIndex: 1,
              }}
              allow="autoplay; encrypted-media; accelerometer; gyroscope"
              referrerPolicy="no-referrer-when-downgrade"
              loading="lazy"
            />
          )}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            background: usesDarkBackground
              ? `linear-gradient(to top, ${theme.bg} 20%, ${theme.bg}E6 50%, ${theme.bg}99 70%, transparent 100%)`
              : `linear-gradient(to top, ${theme.bg} 30%, ${theme.bg}F2 55%, ${theme.bg}CC 80%, ${theme.bg}99 100%)`,
          }} />
        </div>
      )}

      {/* ── Story progress bars (top) ── */}
      <div style={{
        position: 'absolute', top: 20, left: SAFE.side, right: SAFE.side,
        display: 'flex', gap: 6, zIndex: 30,
      }}>
        {Array.from({ length: totalFrames }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 9999,
            backgroundColor: i <= index ? progressActive : progressInactive,
          }} />
        ))}
      </div>

      {/* ── Logo header (within safe zone) ── */}
      <div style={{
        position: 'absolute', top: 50, left: SAFE.side, right: SAFE.side,
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 20,
      }}>
        <img src={imageCache.favicon} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 999 }} />
        <img src={logoSrc} alt="" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
      </div>

      {/* ── HOOK Frame ── */}
      {frame.type === 'hook' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: `${SAFE.top + 80}px ${SAFE.side}px ${SAFE.bottom + 40}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Icon + accent bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 44 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              backgroundColor: theme.accentBg, color: theme.accentText,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${theme.accentBg}50`,
            }}>
              {resolveIcon(frame.icon || 'flame', 36)}
            </div>
            <div style={{ flex: 1, height: 4, borderRadius: 9999, backgroundColor: theme.accent, opacity: 0.5 }} />
          </div>
          <h1 style={{
            fontFamily: headingFont,
            fontSize: getStoryFontSize((frame.headline || '').length),
            fontWeight: 800, lineHeight: 1.08,
            margin: 0, marginBottom: 36,
            whiteSpace: 'pre-wrap',
            letterSpacing: '-0.02em',
          }}>
            {frame.headline}
          </h1>
          {frame.subtext && (
            <span style={{
              display: 'inline-block',
              backgroundColor: theme.accentBg, color: theme.accentText,
              borderRadius: 9999, padding: '14px 32px',
              fontSize: 30, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', alignSelf: 'flex-start',
            }}>
              {frame.subtext}
            </span>
          )}
          {/* Swipe hint at bottom */}
          <div style={{
            position: 'absolute', bottom: SAFE.bottom + 20, left: SAFE.side, right: SAFE.side,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: theme.muted, fontSize: 26, fontWeight: 500, opacity: 0.5,
          }}>
            <ArrowRight size={22} />
            <span>Swipe for more</span>
          </div>
        </div>
      )}

      {/* ── TEASER Frame ── */}
      {frame.type === 'teaser' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: `${SAFE.top + 80}px ${SAFE.side}px ${SAFE.bottom + 80}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Decorative icon */}
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            backgroundColor: `${theme.accent}18`, color: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 32,
          }}>
            {resolveIcon(frame.icon || 'lightbulb', 30)}
          </div>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: 68, fontWeight: 700, lineHeight: 1.08,
            margin: 0, marginBottom: 40,
            letterSpacing: '-0.01em',
          }}>
            {frame.headline}
          </h2>
          {/* Divider line */}
          <div style={{ width: 60, height: 3, borderRadius: 9999, backgroundColor: theme.accent, marginBottom: 36, opacity: 0.6 }} />
          <p style={{
            fontSize: 40, fontWeight: 400, lineHeight: 1.5,
            color: theme.muted, margin: 0, marginBottom: 52,
            whiteSpace: 'pre-wrap',
          }}>
            {frame.subtext}
          </p>
          {frame.ctaLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              color: theme.accent, fontSize: 32, fontWeight: 700,
              letterSpacing: '0.02em',
            }}>
              {resolveIcon(frame.ctaIcon || 'arrowRight', 28)}
              <span>{frame.ctaLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* ── POLL Frame ── */}
      {frame.type === 'poll' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: `${SAFE.top + 80}px ${SAFE.side}px ${SAFE.bottom + 80}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Poll icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 9999,
            backgroundColor: `${theme.accent}20`, color: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center', marginBottom: 40,
          }}>
            {resolveIcon('messageCircle', 32)}
          </div>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: 64, fontWeight: 700, lineHeight: 1.12,
            margin: 0, marginBottom: 56,
            whiteSpace: 'pre-wrap', textAlign: 'center',
            letterSpacing: '-0.01em',
          }}>
            {frame.headline}
          </h2>
          {/* Poll sticker */}
          <div style={{
            backgroundColor: `${theme.text}08`,
            borderRadius: 28, padding: '20px',
            border: `2px solid ${theme.text}12`,
            backdropFilter: 'blur(16px)',
          }}>
            {pollOptions.map((opt, i) => (
              <div key={i} style={{
                backgroundColor: i === 0 ? theme.accentBg : `${theme.text}0A`,
                color: i === 0 ? theme.accentText : theme.text,
                borderRadius: 18, padding: '30px 40px',
                fontSize: 36, fontWeight: 700, textAlign: 'center',
                marginBottom: i < pollOptions.length - 1 ? 14 : 0,
                letterSpacing: '0.01em',
                boxShadow: i === 0 ? `0 4px 16px ${theme.accentBg}30` : 'none',
                transition: 'all 0.2s',
              }}>
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA Frame ── */}
      {frame.type === 'cta' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
          padding: `${SAFE.top + 80}px ${SAFE.side}px ${SAFE.bottom + 80}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Decorative icon */}
          <div style={{
            width: 88, height: 88, borderRadius: 24,
            backgroundColor: theme.accentBg, color: theme.accentText,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 36,
            boxShadow: `0 8px 32px ${theme.accentBg}40`,
          }}>
            {resolveIcon(frame.icon || 'megaphone', 44)}
          </div>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: 88, fontWeight: 800, lineHeight: 1.05,
            margin: 0, marginBottom: 24,
            textTransform: 'uppercase', letterSpacing: '-0.02em',
          }}>
            {frame.headline}
          </h2>
          {frame.subtext && (
            <p style={{
              fontSize: 40, fontWeight: 400, lineHeight: 1.4,
              color: theme.muted, margin: 0, marginBottom: 52,
              maxWidth: 820,
            }}>
              {frame.subtext}
            </p>
          )}
          {frame.ctaLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
              backgroundColor: theme.accentBg, color: theme.accentText,
              borderRadius: 9999, padding: '22px 52px',
              fontSize: 32, fontWeight: 700,
              boxShadow: `0 6px 28px ${theme.accentBg}45`,
              letterSpacing: '0.02em',
            }}>
              {resolveIcon(frame.ctaIcon || 'chevronUp', 26)}
              <span>{frame.ctaLabel}</span>
            </div>
          )}
          {/* Domain */}
          <div style={{
            marginTop: 44,
            fontSize: 26, fontWeight: 500, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: theme.muted, opacity: 0.5,
          }}>
            {CONFIG.brand.domain}
          </div>
        </div>
      )}

      {/* ── Bottom safe zone fade ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: SAFE.bottom + 20,
        background: `linear-gradient(to top, ${theme.bg} 30%, transparent 100%)`,
        pointerEvents: 'none', zIndex: 15,
      }} />
    </div>
  );
}

// Story headline font size — adaptive by char count
function getStoryFontSize(charCount) {
  if (charCount < 30) return 108;
  if (charCount < 50) return 88;
  if (charCount < 80) return 74;
  if (charCount < 120) return 62;
  return 52;
}
