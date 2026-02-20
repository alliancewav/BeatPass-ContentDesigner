// ─── Podcast Canvas ───
// 1920×1080 landscape layout for YouTube podcast video frames.
// Immersive design: blurred cover art background with dark overlay,
// centered cover art, episode metadata, real waveform peaks, and progress bar.
// The parent drives playback via the `elapsed` prop — no internal timer.

import React from 'react';
import { Headphones } from 'lucide-react';
import CONFIG from '../config';
import { withAlpha } from '../lib/colorUtils';

// ── Layout Constants (1920×1080) ──
const W = 1920;
const H = 1080;
const PAD_X = 100;
const PAD_BOTTOM = 72;

export default function PodcastCanvas({
  theme,
  imageCache,
  podcastMeta = {},
  elapsed = 0,       // current playback position in seconds (driven by parent)
  isExport = false,
  overlayOnly = false,
}) {
  const {
    title = 'BeatPass Podcast',
    episodeNumber = 1,
    subtitle = '',
    guestName = '',
    audioDuration = 0,
    coverImage = null,
    waveformPeaks = null,
  } = podcastMeta;

  const headingFont = "'JetBrains Mono', 'Geist', monospace";
  const bodyFont = "'Roboto', 'Geist', system-ui, -apple-system, sans-serif";

  // Derive colour scheme from active theme
  const isDark = theme.logoVariant === 'light';
  const logoSrc = isDark ? imageCache.logoWhite : imageCache.logoBlack;
  const subtleBarColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const progressTrackBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const timerColor = isDark ? 'rgba(255,255,255,0.45)' : withAlpha(theme.text, 0.45);
  const coverShadow = isDark
    ? `0 28px 90px ${withAlpha(theme.bg, 0.55)}`
    : `0 16px 60px ${withAlpha(theme.bg, 0.18)}`;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const totalDurSec = audioDuration || 900;
  const progressPct = totalDurSec > 0 ? Math.min(1, elapsed / totalDurSec) * 100 : 0;
  const elapsedFormatted = formatTime(elapsed);
  const totalDurFormatted = formatTime(totalDurSec);

  // Cover image: use provided, fall back to article cover from imageCache
  const coverSrc = coverImage || imageCache.cover;

  // Waveform: use real peaks if available, otherwise generate decorative bars
  const BAR_COUNT = 120;
  const waveformBars = waveformPeaks && waveformPeaks.length > 0
    ? resamplePeaks(waveformPeaks, BAR_COUNT)
    : generateFallbackBars(title, BAR_COUNT);

  // In export mode: hide the elapsed timer text (ffmpeg draws it animated)
  // In export mode: hide the progress fill (ffmpeg draws it animated via drawbox)
  const hideAnimatedElements = isExport;

  return (
    <div
      id="export-root"
      style={{
        position: 'relative',
        width: W,
        height: H,
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: bodyFont,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Blurred cover art background ── */}
      {coverSrc && !overlayOnly && (
        <img
          src={coverSrc}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', filter: 'blur(80px) saturate(1.4)', transform: 'scale(1.3)',
            zIndex: 0,
          }}
        />
      )}

      {/* ── Overlay on top of blurred bg — tinted with theme.bg ── */}
      {!overlayOnly && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: isDark
            ? `linear-gradient(180deg, ${withAlpha(theme.bg, 0.65)} 0%, ${withAlpha(theme.bg, 0.78)} 50%, ${withAlpha(theme.bg, 0.88)} 100%)`
            : `linear-gradient(180deg, ${withAlpha(theme.bg, 0.66)} 0%, ${withAlpha(theme.bg, 0.78)} 50%, ${withAlpha(theme.bg, 0.91)} 100%)`,
        }} />
      )}

      {/* ── Subtle noise texture ── */}
      {!overlayOnly && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, opacity: 0.04,
          backgroundImage: `radial-gradient(circle, ${withAlpha(theme.text, 0.6)} 1px, transparent 1px)`,
          backgroundSize: '5px 5px',
        }} />
      )}

      {/* ── Futuristic brand decorations ── */}
      {!overlayOnly && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
            backgroundImage: `radial-gradient(${withAlpha(theme.text, 0.027)} 1.5px, transparent 1.5px)`,
            backgroundSize: '64px 64px' }} />
          <div style={{ position: 'absolute', bottom: 60, right: PAD_X - 20,
            width: 48, height: 48, zIndex: 4, pointerEvents: 'none',
            borderRight: `2px solid ${withAlpha(theme.accent, 0.19)}`, borderBottom: `2px solid ${withAlpha(theme.accent, 0.19)}` }} />
        </>
      )}
      {/* ── Header Bar ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `44px ${PAD_X}px 0`,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={imageCache.favicon} alt="" style={{ width: 56, height: 56, objectFit: 'contain', marginRight: 16, flexShrink: 0 }} />
          <img src={logoSrc} alt="" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div style={{
          backgroundColor: withAlpha(theme.accent, 0.125),
          color: theme.accent,
          borderRadius: 9999, padding: '14px 30px',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          border: `1px solid ${withAlpha(theme.accent, 0.21)}`,
        }}>
          <Headphones size={22} strokeWidth={2} style={{ opacity: 0.8 }} />
          <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.95 }}>
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
        gap: 72,
        boxSizing: 'border-box',
      }}>
        {/* Cover Art — 1:1 square with glow */}
        {coverSrc && !overlayOnly && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {/* Glow behind cover */}
            <div style={{
              position: 'absolute', inset: -32,
              background: `radial-gradient(circle, ${withAlpha(theme.accent, 0.27)} 0%, ${withAlpha(theme.accent, 0.094)} 40%, transparent 70%)`,
              filter: 'blur(44px)',
              zIndex: 0,
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              width: 520, height: 520,
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: coverShadow,
            }}>
              <img src={coverSrc} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              }} />
            </div>
          </div>
        )}
        {/* Placeholder square in overlay mode (maintains layout positioning) */}
        {overlayOnly && (
          <div style={{ width: 520, height: 520, flexShrink: 0 }} />
        )}

        {/* Episode Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Episode subtitle / article title (PRIMARY hero) */}
          {subtitle ? (
            <h1 style={{
              fontFamily: headingFont,
              fontSize: getPodcastSubtitleFontSize(subtitle.length),
              fontWeight: 800, lineHeight: 1.08,
              margin: 0, marginBottom: 22,
              color: theme.text,
              maxWidth: 920,
            }}>
              {subtitle}
            </h1>
          ) : (
            /* Fallback: show podcast title when no subtitle */
            <h1 style={{
              fontFamily: headingFont,
              fontSize: getPodcastTitleFontSize(title.length),
              fontWeight: 800, lineHeight: 1.06,
              margin: 0, marginBottom: 20,
              color: theme.text,
            }}>
              {title}
            </h1>
          )}

          {/* Podcast show title (SECONDARY) */}
          {subtitle && (
            <p style={{
              fontSize: 30, fontWeight: 500, lineHeight: 1.3,
              color: theme.muted, margin: 0, marginBottom: 16,
              opacity: 0.7,
            }}>
              {title}
            </p>
          )}

          {/* Guest / Host name */}
          {guestName && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              marginTop: subtitle ? 8 : 6,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: 9999,
                backgroundColor: theme.accent, opacity: 0.6,
              }} />
              <span style={{
                fontSize: 26, fontWeight: 500, letterSpacing: '0.02em',
                color: theme.muted,
              }}>
                {guestName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Waveform + Progress Bar (bottom section) ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: `0 ${PAD_X}px ${PAD_BOTTOM}px`,
        boxSizing: 'border-box',
      }}>
        {/* Waveform visualization — real audio peaks or fallback */}
        <div
          data-waveform-region="true"
          style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 2, height: 72, marginBottom: 24,
          }}
        >
          {waveformBars.map((barH, i) => {
            const barPct = (i / waveformBars.length) * 100;
            const isBeforeProgress = barPct < progressPct;
            return (
              <div
                key={i}
                style={{
                  width: Math.max(3, Math.floor((W - PAD_X * 2) / waveformBars.length) - 2),
                  height: Math.max(4, barH),
                  borderRadius: 2,
                  backgroundColor: overlayOnly
                    ? subtleBarColor
                    : isBeforeProgress
                      ? theme.accent
                      : subtleBarColor,
                  opacity: overlayOnly ? 1 : isBeforeProgress ? 0.85 : 0.4,
                  transition: overlayOnly ? 'none' : 'background-color 0.15s ease, opacity 0.15s ease',
                }}
              />
            );
          })}
        </div>

        {/* Progress track + time labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Progress track */}
          <div
            data-progress-track="true"
            style={{
              width: '100%', height: 6, borderRadius: 9999,
              backgroundColor: progressTrackBg,
              overflow: 'hidden', position: 'relative',
            }}
          >
            {/* Fill — hidden in export mode (ffmpeg draws it animated via drawbox) */}
            {!hideAnimatedElements && !overlayOnly && (
              <div style={{
                width: `${progressPct}%`, height: '100%', borderRadius: 9999,
                backgroundColor: theme.accent,
                transition: 'width 0.3s linear',
              }} />
            )}
          </div>
          {/* Time labels */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 24, fontWeight: 500, color: timerColor,
            fontFamily: "'JetBrains Mono', 'DejaVu Sans Mono', monospace",
          }}>
            <span
              data-timer-elapsed="true"
              style={hideAnimatedElements || overlayOnly ? { visibility: 'hidden' } : undefined}
            >{hideAnimatedElements || overlayOnly ? '0:00' : elapsedFormatted}</span>
            <span>{totalDurFormatted}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function getPodcastSubtitleFontSize(charCount) {
  if (charCount < 24) return 72;
  if (charCount < 40) return 62;
  if (charCount < 58) return 52;
  if (charCount < 80) return 44;
  return 38;
}

function getPodcastTitleFontSize(charCount) {
  if (charCount < 20) return 78;
  if (charCount < 35) return 66;
  if (charCount < 50) return 56;
  if (charCount < 70) return 48;
  return 40;
}

// Resample real waveform peaks to target bar count, returning heights in px (4–72)
function resamplePeaks(peaks, targetCount) {
  const step = peaks.length / targetCount;
  const bars = [];
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let max = 0;
    for (let j = start; j < end && j < peaks.length; j++) {
      if (peaks[j] > max) max = peaks[j];
    }
    // peaks are 0–1, map to 4–72px
    bars.push(4 + Math.round(max * 68));
  }
  return bars;
}

// Fallback: generate decorative waveform bar heights from a seed string
function generateFallbackBars(seed, count = 120) {
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
    const height = 6 + Math.floor(normalized * 58 * centerWeight);
    bars.push(height);
  }
  return bars;
}

export { W as PODCAST_W, H as PODCAST_H };
