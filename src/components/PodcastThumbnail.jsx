// ─── Podcast YouTube Thumbnail ───
// 1280×720 landscape thumbnail for YouTube.
// Mirrors the PodcastCanvas (video) layout scaled to thumbnail dimensions
// and uses the same dynamic theme system as carousel slides and stories.
//
// Design:
//   - Header bar: favicon + logo (left), EP badge (right)
//   - Center: cover art (left) + episode info (right)
//   - Bottom: decorative waveform + accent bar
//   - All colours from `theme.*` — never hardcoded

import React from 'react';
import { Headphones } from 'lucide-react';

export const THUMB_W = 1280;
export const THUMB_H = 720;

// Scale factor from PodcastCanvas (1920×1080) → Thumbnail (1280×720) = 2/3
const S = 2 / 3;

export default function PodcastThumbnail({
  theme,
  imageCache,
  podcastMeta = {},
}) {
  const {
    title = 'BeatPass Podcast',
    episodeNumber = 1,
    subtitle = '',
    guestName = '',
    coverImage = null,
  } = podcastMeta;

  const headingFont = "'JetBrains Mono', 'Geist', monospace";
  const bodyFont = "'Roboto', 'Geist', system-ui, -apple-system, sans-serif";

  const usesDarkBackground = theme.logoVariant === 'light';
  const logoSrc = usesDarkBackground ? imageCache.logoWhite : imageCache.logoBlack;
  const coverSrc = coverImage || imageCache.cover;

  const PAD_X = Math.round(100 * S);   // 67
  const PAD_BOTTOM = Math.round(72 * S); // 48

  // Title font size — scale from PodcastCanvas logic
  const titleLen = title.length;
  const titleFontSize = titleLen < 20 ? Math.round(78 * S)
    : titleLen < 35 ? Math.round(66 * S)
    : titleLen < 50 ? Math.round(56 * S)
    : titleLen < 70 ? Math.round(48 * S)
    : Math.round(40 * S);

  // Cover size — scaled from 480 in PodcastCanvas
  const coverSize = Math.round(480 * S); // 320

  // Waveform bars — scaled from PodcastCanvas
  const BAR_COUNT = 80;
  const waveformBars = generateFallbackBars(title + episodeNumber, BAR_COUNT);

  return (
    <div
      id="export-root"
      style={{
        position: 'relative',
        width: THUMB_W,
        height: THUMB_H,
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: bodyFont,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Blurred cover art background ── */}
      {coverSrc && (
        <img
          src={coverSrc}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', filter: 'blur(60px) saturate(1.4)', transform: 'scale(1.3)',
            zIndex: 0,
          }}
        />
      )}

      {/* ── Dark overlay (theme-based) ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: usesDarkBackground
          ? `linear-gradient(180deg, ${theme.bg}A8 0%, ${theme.bg}CC 50%, ${theme.bg}E6 100%)`
          : `linear-gradient(180deg, ${theme.bg}CC 0%, ${theme.bg}E6 50%, ${theme.bg}F2 100%)`,
      }} />

      {/* ── Subtle noise texture ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, opacity: 0.03,
        backgroundImage: usesDarkBackground
          ? 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)'
          : 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
        backgroundSize: '4px 4px',
      }} />

      {/* ── Header Bar ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `${Math.round(48 * S)}px ${PAD_X}px 0`,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={imageCache.favicon} alt="" style={{ width: Math.round(56 * S), height: Math.round(56 * S), objectFit: 'contain', marginRight: Math.round(16 * S), flexShrink: 0 }} />
          <img src={logoSrc} alt="" style={{ height: Math.round(42 * S), width: 'auto', objectFit: 'contain', opacity: 0.9 }} />
        </div>
        <div style={{
          backgroundColor: usesDarkBackground ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          color: theme.text,
          borderRadius: 9999, padding: `${Math.round(14 * S)}px ${Math.round(30 * S)}px`,
          display: 'inline-flex', alignItems: 'center', gap: Math.round(10 * S),
          border: usesDarkBackground ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
        }}>
          <Headphones size={Math.round(22 * S)} strokeWidth={2} style={{ opacity: 0.8 }} />
          <span style={{ fontFamily: headingFont, fontSize: Math.round(24 * S), fontWeight: 700, lineHeight: 1, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.95 }}>
            EP {episodeNumber}
          </span>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        flex: 1,
        display: 'flex', alignItems: 'center',
        padding: `0 ${PAD_X}px`,
        gap: Math.round(72 * S),
        boxSizing: 'border-box',
      }}>
        {/* Cover Art — 1:1 square with glow */}
        {coverSrc && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {/* Glow behind cover */}
            <div style={{
              position: 'absolute', inset: -16,
              background: `radial-gradient(circle, ${theme.accent}30 0%, transparent 70%)`,
              filter: 'blur(36px)',
              zIndex: 0,
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              width: coverSize, height: coverSize,
              borderRadius: Math.round(24 * S),
              overflow: 'hidden',
              boxShadow: usesDarkBackground
                ? '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)'
                : '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)',
            }}>
              <img src={coverSrc} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              }} />
            </div>
          </div>
        )}
        {/* Placeholder square when no cover */}
        {!coverSrc && (
          <div style={{
            width: coverSize, height: coverSize, flexShrink: 0,
            borderRadius: Math.round(24 * S),
            backgroundColor: usesDarkBackground ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            border: usesDarkBackground ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Headphones size={60} style={{ opacity: 0.15, color: theme.text }} />
          </div>
        )}

        {/* Episode Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* "Now Playing" label */}
          <div style={{
            fontFamily: headingFont,
            fontSize: Math.round(20 * S), fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: theme.accent, marginBottom: Math.round(24 * S), opacity: 0.9,
          }}>
            Now Playing
          </div>

          {/* Podcast Title */}
          <h1 style={{
            fontFamily: headingFont,
            fontSize: titleFontSize,
            fontWeight: 800, lineHeight: 1.06,
            margin: 0, marginBottom: Math.round(20 * S),
            color: theme.text,
          }}>
            {title}
          </h1>

          {/* Episode subtitle / article title */}
          {subtitle && (
            <p style={{
              fontSize: Math.round(32 * S), fontWeight: 400, lineHeight: 1.35,
              color: theme.muted, margin: 0, marginBottom: Math.round(16 * S),
              maxWidth: Math.round(780 * S),
              opacity: 0.7,
            }}>
              {subtitle}
            </p>
          )}

          {/* Guest / Host name */}
          {guestName && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: Math.round(12 * S),
              marginTop: Math.round(6 * S),
            }}>
              <div style={{
                width: Math.round(7 * S), height: Math.round(7 * S), borderRadius: 9999,
                backgroundColor: theme.accent, opacity: 0.6,
              }} />
              <span style={{
                fontSize: Math.round(26 * S), fontWeight: 500, letterSpacing: '0.02em',
                color: theme.muted, opacity: 0.65,
              }}>
                {guestName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Waveform + Accent Bar (bottom section) ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: `0 ${PAD_X}px ${PAD_BOTTOM}px`,
        boxSizing: 'border-box',
      }}>
        {/* Waveform visualization */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 2, height: Math.round(48 * S), marginBottom: Math.round(16 * S),
        }}>
          {waveformBars.map((barH, i) => (
            <div
              key={i}
              style={{
                width: Math.max(2, Math.floor((THUMB_W - PAD_X * 2) / BAR_COUNT) - 2),
                height: Math.max(3, Math.round(barH * S)),
                borderRadius: 2,
                backgroundColor: theme.accent,
                opacity: 0.2,
              }}
            />
          ))}
        </div>

        {/* Accent progress bar (static — just a visual element) */}
        <div style={{
          width: '100%', height: Math.round(7 * S), borderRadius: 9999,
          backgroundColor: usesDarkBackground ? `${theme.text}18` : `${theme.text}12`,
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            width: '35%', height: '100%', borderRadius: 9999,
            backgroundColor: theme.accent,
            opacity: 0.8,
          }} />
        </div>
      </div>
    </div>
  );
}

// Fallback: generate decorative waveform bar heights from a seed string
function generateFallbackBars(seed, count = 80) {
  const bars = [];
  let hash = 0;
  const str = seed || 'podcast';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < count; i++) {
    hash = ((hash << 5) - hash + i * 7 + 13) | 0;
    const normalized = Math.abs(hash % 100) / 100;
    const centerWeight = 1 - Math.abs((i / count) - 0.5) * 0.6;
    const height = 6 + Math.floor(normalized * 38 * centerWeight);
    bars.push(height);
  }
  return bars;
}
