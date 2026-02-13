// ─── Story Canvas ───
// Renders a single Instagram Story frame at 1080×1920 (9:16).
// Same inline-style approach as SlideCanvas.jsx for html-to-image export compatibility.

import React from 'react';
import {
  ChevronUp, ArrowRight, ArrowDown, Flame, Smartphone,
  Megaphone, Zap, Eye, BookOpen, Lightbulb, Star,
  MessageCircle, Share2, Link2, Sparkles, AlertCircle,
  Heart, TrendingUp, Music, Headphones, Mic2, Radio,
  Gift, Trophy, Target, Bookmark, Hash, AtSign,
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

// Content area start — below logo header row
const CONTENT_TOP = SAFE.top + 120;

// ── Icon map: story frames store icon name strings, we resolve to components here ──
export const ICON_MAP = {
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
  heart: Heart,
  trendingUp: TrendingUp,
  music: Music,
  headphones: Headphones,
  mic2: Mic2,
  radio: Radio,
  gift: Gift,
  trophy: Trophy,
  target: Target,
  bookmark: Bookmark,
  hash: Hash,
  atSign: AtSign,
};

// Icon display names for the picker
export const ICON_OPTIONS = Object.keys(ICON_MAP);

// Curated subset of icons suitable for CTA buttons
export const CTA_ICON_OPTIONS = [
  'arrowRight', 'chevronUp', 'link2', 'arrowDown', 'star',
  'megaphone', 'bookOpen', 'sparkles', 'heart', 'zap',
];

const resolveIcon = (name, size = 48, style = {}) => {
  const Comp = ICON_MAP[name];
  if (!Comp) return null;
  return <Comp size={size} style={style} />;
};

// YouTube ID validation
const isValidYouTubeId = (id) => /^[A-Za-z0-9_-]{11}$/.test(id);

export default function StoryCanvas({ frame, index, totalFrames, theme, imageCache, coverOverride, coverYouTubeId = null, coverMediaMode = 'thumbnail', isExport = false }) {
  if (!frame) return null;

  // A1: Resolve background image at render time — prefer global coverOverride over baked frame.image
  const resolvedImage = coverOverride || frame.image || null;
  const safeYtId = coverYouTubeId && isValidYouTubeId(coverYouTubeId) ? coverYouTubeId : null;
  const showVideoEmbed = safeYtId && coverMediaMode === 'video' && !isExport;

  const usesDarkBackground = theme.logoVariant === 'light';
  const logoSrc = usesDarkBackground ? imageCache.logoWhite : imageCache.logoBlack;
  const headingFont = "'JetBrains Mono', 'Geist', monospace";
  const bodyFont = "'Roboto', 'Geist', system-ui, -apple-system, sans-serif";

  // D4: Extract poll options once
  const pollOptions = frame.pollOptions || ['Yes', 'No'];

  // Theme-aware badge bg
  const badgeBg = usesDarkBackground ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

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
          {resolvedImage && (
            <img
              src={resolvedImage}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          {showVideoEmbed && (
            <iframe
              src={`https://www.youtube.com/embed/${safeYtId}?autoplay=1&mute=1&loop=1&playlist=${safeYtId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&playsinline=1&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              sandbox="allow-scripts allow-same-origin"
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

      {/* ── Logo header — INSIDE IG safe zone ── */}
      <div style={{
        position: 'absolute', top: SAFE.top + 20, left: SAFE.side, right: SAFE.side,
        display: 'flex', alignItems: 'center', gap: 16, zIndex: 20,
      }}>
        <img src={imageCache.favicon} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 999 }} />
        <img src={logoSrc} alt="" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
        {/* Frame counter pill */}
        <div style={{
          marginLeft: 'auto',
          backgroundColor: badgeBg,
          borderRadius: 9999, padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {index + 1} / {totalFrames}
          </span>
        </div>
      </div>

      {/* ── HOOK Frame ── */}
      {frame.type === 'hook' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: `${CONTENT_TOP}px ${SAFE.side}px ${SAFE.bottom + 40}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Large icon badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 48 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 28,
              backgroundColor: theme.accentBg, color: theme.accentText,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 32px ${theme.accentBg}50`,
            }}>
              {resolveIcon(frame.icon || 'flame', 48)}
            </div>
            <div style={{ flex: 1, height: 4, borderRadius: 9999, backgroundColor: theme.accent, opacity: 0.4 }} />
          </div>
          <h1 style={{
            fontFamily: headingFont,
            fontSize: getStoryFontSize((frame.headline || '').length),
            fontWeight: 800, lineHeight: 1.08,
            margin: 0, marginBottom: 40,
            whiteSpace: 'pre-wrap',
            letterSpacing: '-0.02em',
          }}>
            {frame.headline}
          </h1>
          {frame.subtext && (
            <span style={{
              display: 'inline-block',
              backgroundColor: theme.accentBg, color: theme.accentText,
              borderRadius: 9999, padding: '16px 36px',
              fontSize: 32, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', alignSelf: 'flex-start',
            }}>
              {frame.subtext}
            </span>
          )}
          {/* Swipe hint — editable, hidden when empty */}
          {(frame.swipeHint ?? 'Swipe for more') && (
            <div style={{
              position: 'absolute', bottom: SAFE.bottom + 24, left: SAFE.side, right: SAFE.side,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              color: theme.muted, fontSize: 28, fontWeight: 500, opacity: 0.45,
            }}>
              <ArrowRight size={24} />
              <span>{frame.swipeHint ?? 'Swipe for more'}</span>
            </div>
          )}
        </div>
      )}

      {/* ── TEASER Frame ── */}
      {frame.type === 'teaser' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: `${CONTENT_TOP}px ${SAFE.side}px ${SAFE.bottom + 60}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Icon */}
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: `${theme.accent}18`, color: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 40,
          }}>
            {resolveIcon(frame.icon || 'lightbulb', 40)}
          </div>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: 72, fontWeight: 700, lineHeight: 1.08,
            margin: 0, marginBottom: 44,
            letterSpacing: '-0.01em',
          }}>
            {frame.headline}
          </h2>
          {/* Accent divider */}
          <div style={{ width: 72, height: 4, borderRadius: 9999, backgroundColor: theme.accent, marginBottom: 40, opacity: 0.5 }} />
          <p style={{
            fontSize: 42, fontWeight: 400, lineHeight: 1.5,
            color: theme.muted, margin: 0, marginBottom: 56,
            whiteSpace: 'pre-wrap',
          }}>
            {frame.subtext}
          </p>
          {frame.ctaLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              color: theme.accent, fontSize: 34, fontWeight: 700,
              letterSpacing: '0.02em',
            }}>
              {resolveIcon(frame.ctaIcon || 'arrowRight', 30)}
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
          padding: `${CONTENT_TOP}px ${SAFE.side}px ${SAFE.bottom + 60}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Poll icon */}
          <div style={{
            width: 80, height: 80, borderRadius: 9999,
            backgroundColor: `${theme.accent}20`, color: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center', marginBottom: 44,
          }}>
            {resolveIcon(frame.icon || 'messageCircle', 40)}
          </div>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: 68, fontWeight: 700, lineHeight: 1.12,
            margin: 0, marginBottom: 60,
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
                borderRadius: 20, padding: '34px 44px',
                fontSize: 38, fontWeight: 700, textAlign: 'center',
                marginBottom: i < pollOptions.length - 1 ? 16 : 0,
                letterSpacing: '0.01em',
                boxShadow: i === 0 ? `0 4px 16px ${theme.accentBg}30` : 'none',
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
          padding: `${CONTENT_TOP}px ${SAFE.side}px ${SAFE.bottom + 60}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Large icon */}
          <div style={{
            width: 120, height: 120, borderRadius: 32,
            backgroundColor: theme.accentBg, color: theme.accentText,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 44,
            boxShadow: `0 12px 48px ${theme.accentBg}45`,
          }}>
            {resolveIcon(frame.icon || 'megaphone', 56)}
          </div>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: 92, fontWeight: 800, lineHeight: 1.05,
            margin: 0, marginBottom: 28,
            textTransform: 'uppercase', letterSpacing: '-0.02em',
          }}>
            {frame.headline}
          </h2>
          {frame.subtext && (
            <p style={{
              fontSize: 42, fontWeight: 400, lineHeight: 1.4,
              color: theme.muted, margin: 0, marginBottom: 56,
              maxWidth: 860,
            }}>
              {frame.subtext}
            </p>
          )}
          {frame.ctaLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
              backgroundColor: theme.accentBg, color: theme.accentText,
              borderRadius: 9999, padding: '24px 56px',
              fontSize: 34, fontWeight: 700,
              boxShadow: `0 6px 28px ${theme.accentBg}45`,
              letterSpacing: '0.02em',
            }}>
              {resolveIcon(frame.ctaIcon || 'chevronUp', 28)}
              <span>{frame.ctaLabel}</span>
            </div>
          )}
          {/* Domain — editable */}
          {(frame.domain || CONFIG.brand.domain) && (
            <div style={{
              marginTop: 48,
              fontSize: 28, fontWeight: 500, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: theme.muted, opacity: 0.5,
            }}>
              {frame.domain || CONFIG.brand.domain}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom safe zone fade ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: SAFE.bottom,
        background: `linear-gradient(to top, ${theme.bg} 40%, transparent 100%)`,
        pointerEvents: 'none', zIndex: 15,
      }} />
    </div>
  );
}

// Story headline font size — adaptive by char count
function getStoryFontSize(charCount) {
  if (charCount < 30) return 112;
  if (charCount < 50) return 92;
  if (charCount < 80) return 78;
  if (charCount < 120) return 66;
  return 54;
}
