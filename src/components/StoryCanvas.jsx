// ─── Story Canvas ───
// Renders a single Instagram Story frame at 1080×1920 (9:16).
// Same inline-style approach as SlideCanvas.jsx for html-to-image export compatibility.

import React from 'react';
import {
  ChevronUp, ArrowRight, ArrowDown, Flame, Smartphone,
  Megaphone, Zap, Eye, BookOpen, Lightbulb, Star,
  MessageCircle, Share2, Link2, Sparkles, AlertCircle,
  Heart, TrendingUp, Music, Headphones, Mic2, Radio,
  Gift, Trophy, Target, Bookmark, Hash, AtSign, Bell, CheckCircle,
} from 'lucide-react';
import CONFIG from '../config';
import { withAlpha } from '../lib/colorUtils';

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
  bell: Bell,
  checkCircle: CheckCircle,
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

// CTA hero text font size — adaptive by char count
function getCtaHeroFontSize(text) {
  const tl = (text || '').length;
  if (tl < 30) return 110;
  if (tl < 45) return 96;
  if (tl < 60) return 86;
  if (tl < 80) return 76;
  if (tl < 110) return 66;
  if (tl < 140) return 58;
  return 52;
}

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
              ? `linear-gradient(to top, ${theme.bg} 20%, ${withAlpha(theme.bg, 0.90)} 50%, ${withAlpha(theme.bg, 0.60)} 70%, transparent 100%)`
              : `linear-gradient(to top, ${theme.bg} 30%, ${withAlpha(theme.bg, 0.95)} 55%, ${withAlpha(theme.bg, 0.80)} 80%, ${withAlpha(theme.bg, 0.60)} 100%)`,
          }} />
        </div>
      )}

      {/* ── Futuristic bg decorations (no background image) ── */}
      {!resolvedImage && !showVideoEmbed && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            backgroundImage: `radial-gradient(${withAlpha(theme.text, 0.027)} 1.5px, transparent 1.5px)`,
            backgroundSize: '72px 72px' }} />
          <div style={{ position: 'absolute', bottom: -200, right: -120, zIndex: 1, pointerEvents: 'none',
            width: 800, height: 800, borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha(theme.accent, 0.10)} 0%, transparent 65%)` }} />
          <div style={{ position: 'absolute', top: 180, left: 0, zIndex: 1, pointerEvents: 'none',
            width: 600, height: 600, borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha(theme.accent, 0.063)} 0%, transparent 65%)` }} />
          <div style={{ position: 'absolute', bottom: 280, right: SAFE.side - 20,
            width: 50, height: 50, zIndex: 2, pointerEvents: 'none',
            borderRight: `2px solid ${withAlpha(theme.accent, 0.19)}`, borderBottom: `2px solid ${withAlpha(theme.accent, 0.19)}` }} />
        </>
      )}
      {/* ── Logo header — INSIDE IG safe zone ── */}
      <div style={{
        position: 'absolute', top: SAFE.top + 20, left: SAFE.side, right: SAFE.side,
        display: 'flex', alignItems: 'center', gap: 16, zIndex: 20,
      }}>
        <img src={imageCache.favicon} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
        <img src={logoSrc} alt="" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
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
              width: 96, height: 96, borderRadius: 26,
              backgroundColor: theme.accentBg, color: theme.accentText,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 32px ${withAlpha(theme.accentBg, 0.33)}, 0 0 0 1px ${withAlpha(theme.accentBg, 0.25)}`,
            }}>
              {resolveIcon(frame.icon || 'flame', 48)}
            </div>
            <div style={{ flex: 1, height: 4, borderRadius: 9999, backgroundColor: theme.accent,
              boxShadow: `0 0 14px ${withAlpha(theme.accent, 0.50)}`, opacity: 0.75 }} />
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
          {/* Swipe hint — editable, hidden when explicitly set to empty string */}
          {frame.swipeHint !== '' && (
            <div style={{
              position: 'absolute', bottom: SAFE.bottom + 24, left: SAFE.side, right: SAFE.side,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              color: theme.text, fontSize: 28, fontWeight: 500, opacity: 0.35,
              letterSpacing: '0.02em',
            }}>
              <ArrowRight size={22} />
              <span>{frame.swipeHint || 'Swipe for more'}</span>
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
            backgroundColor: withAlpha(theme.accent, 0.10), color: theme.accent,
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
          <div style={{ width: 56, height: 4, borderRadius: 9999, backgroundColor: theme.accent,
            boxShadow: `0 0 14px ${withAlpha(theme.accent, 0.50)}`, marginBottom: 40 }} />
          {frame.bullets && frame.bullets.length > 0 ? (
            <div style={{ marginBottom: 44 }}>
              {frame.bullets.slice(0, 4).map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 22 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: theme.accent,
                    boxShadow: `0 0 8px ${withAlpha(theme.accent, 0.50)}`, flexShrink: 0, marginTop: 17 }} />
                  <span style={{ fontSize: 38, fontWeight: 400, lineHeight: 1.45, color: theme.text, opacity: 0.85 }}>{b}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{
              fontSize: 42, fontWeight: 400, lineHeight: 1.5,
              color: theme.text, opacity: 0.85, margin: 0, marginBottom: 56,
              whiteSpace: 'pre-wrap',
            }}>
              {frame.subtext}
            </p>
          )}
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
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: withAlpha(theme.accent, 0.10), color: theme.accent,
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
            backgroundColor: withAlpha(theme.text, 0.031),
            borderRadius: 28, padding: '20px',
            border: `2px solid ${withAlpha(theme.text, 0.071)}`,
            backdropFilter: 'blur(16px)',
          }}>
            {pollOptions.map((opt, i) => (
              <div key={i} style={{
                backgroundColor: i === 0 ? theme.accentBg : withAlpha(theme.text, 0.039),
                color: i === 0 ? theme.accentText : theme.text,
                borderRadius: 20, padding: '34px 44px',
                fontSize: 38, fontWeight: 700, textAlign: 'center',
                marginBottom: i < pollOptions.length - 1 ? 16 : 0,
                letterSpacing: '0.01em',
                boxShadow: i === 0 ? `0 4px 16px ${withAlpha(theme.accentBg, 0.19)}` : 'none',
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
          {/* Accent glow bar */}
          <div style={{
            width: 80, height: 5, borderRadius: 9999,
            backgroundColor: theme.accent,
            boxShadow: `0 0 18px ${withAlpha(theme.accent, 0.50)}`,
            marginBottom: 40,
          }} />
          {/* Compact label badge — outline style with icon */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            border: `1.5px solid ${withAlpha(theme.accent, 0.31)}`,
            borderRadius: 9999, padding: '14px 32px',
            marginBottom: 52,
            backgroundColor: withAlpha(theme.accent, 0.071),
          }}>
            {resolveIcon(frame.icon || 'megaphone', 28, { color: theme.accent, opacity: 0.9 })}
            <span style={{
              fontFamily: headingFont,
              fontSize: 30, fontWeight: 700, lineHeight: 1,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: theme.accent,
            }}>
              {frame.headline}
            </span>
          </div>
          {/* Article title — hero text, adaptive size */}
          {frame.subtext && (
              <h2 style={{
                fontFamily: headingFont,
                fontSize: getCtaHeroFontSize(frame.subtext),
                fontWeight: 800, lineHeight: 1.1,
                margin: 0, marginBottom: 60,
                letterSpacing: '-0.02em',
                maxWidth: 940,
              }}>
                {frame.subtext}
              </h2>
          )}
          {frame.ctaLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
              backgroundColor: theme.accentBg, color: theme.accentText,
              borderRadius: 9999, padding: '26px 60px',
              fontSize: 34, fontWeight: 700,
              boxShadow: `0 6px 28px ${withAlpha(theme.accentBg, 0.27)}`,
              letterSpacing: '0.02em',
            }}>
              {resolveIcon(frame.ctaIcon || 'chevronUp', 28)}
              <span>{frame.ctaLabel}</span>
            </div>
          )}
          {/* Domain */}
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

      {/* ── TIP Frame ── */}
      {frame.type === 'tip' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: `${CONTENT_TOP}px ${SAFE.side}px ${SAFE.bottom + 60}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Icon + label row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: withAlpha(theme.accent, 0.10), color: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {resolveIcon(frame.icon || 'lightbulb', 40)}
            </div>
            <span style={{ fontFamily: headingFont, fontSize: 28, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.accent, opacity: 0.9 }}>
              {frame.tipLabel || 'Pro Tip'}
            </span>
          </div>
          <h2 style={{
            fontFamily: headingFont, fontSize: getStoryFontSize((frame.headline || '').length * 1.2),
            fontWeight: 800, lineHeight: 1.08, margin: 0, marginBottom: 40,
            letterSpacing: '-0.01em',
          }}>
            {frame.headline}
          </h2>
          <div style={{ width: 56, height: 4, borderRadius: 9999, backgroundColor: theme.accent,
            boxShadow: `0 0 14px ${withAlpha(theme.accent, 0.50)}`, marginBottom: 40 }} />
          {frame.subtext && (
            <div style={{
              backgroundColor: withAlpha(theme.accent, 0.071),
              borderLeft: `5px solid ${theme.accent}`,
              boxShadow: `-2px 0 18px ${withAlpha(theme.accent, 0.19)}`,
              borderRadius: '0 16px 16px 0',
              padding: '32px 40px',
            }}>
              <p style={{ fontSize: 40, fontWeight: 400, lineHeight: 1.5,
                color: theme.text, opacity: 0.88, margin: 0, whiteSpace: 'pre-wrap' }}>
                {frame.subtext}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── QUOTE Frame ── */}
      {frame.type === 'quote' && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: `${CONTENT_TOP}px ${SAFE.side}px ${SAFE.bottom + 60}px`,
          height: '100%', boxSizing: 'border-box',
        }}>
          {/* Large quotation mark */}
          <div style={{ fontSize: 200, lineHeight: 0.7, color: theme.accent, opacity: 0.3,
            fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 900, marginBottom: 20, userSelect: 'none' }}>
            “
          </div>
          <blockquote style={{
            fontFamily: headingFont,
            fontSize: getStoryFontSize(((frame.headline || '').length) * 1.3),
            fontWeight: 700, lineHeight: 1.15,
            margin: 0, marginBottom: 48,
            letterSpacing: '-0.01em', fontStyle: 'italic',
            whiteSpace: 'pre-wrap',
          }}>
            {frame.headline}
          </blockquote>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 56, height: 4, borderRadius: 9999, backgroundColor: theme.accent,
              boxShadow: `0 0 14px ${withAlpha(theme.accent, 0.50)}` }} />
            {frame.subtext && (
              <span style={{ fontSize: 34, fontWeight: 600, color: theme.accent, opacity: 0.85,
                letterSpacing: '0.04em' }}>
                {frame.subtext}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom safe zone fade ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: SAFE.bottom,
        background: `linear-gradient(to top, ${theme.bg} 30%, ${withAlpha(theme.bg, 0.80)} 55%, transparent 100%)`,
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
