// ─── Podcast Canvas ───
// 1920×1080 landscape layout for YouTube podcast video frames.
// Immersive design: blurred cover art background with dark overlay,
// centered cover art, episode metadata, real waveform peaks, and progress bar.
// The parent drives playback via the `elapsed` prop — no internal timer.

import React from 'react';
import { Headphones } from 'lucide-react';
import CONFIG from '../config';

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

  const usesDarkBackground = theme.logoVariant === 'light';
  const logoSrc = usesDarkBackground ? imageCache.logoWhite : imageCache.logoBlack;

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
        backgroundColor: '#0A0A0A',
        color: '#FFFFFF',
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

      {/* ── Dark overlay on top of blurred bg ── */}
      {!overlayOnly && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 50%, rgba(0,0,0,0.88) 100%)',
        }} />
      )}

      {/* ── Subtle noise texture ── */}
      {!overlayOnly && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, opacity: 0.03,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '4px 4px',
        }} />
      )}

      {/* ── Header Bar ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `48px ${PAD_X}px 0`,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={imageCache.favicon} alt="" style={{ width: 56, height: 56, objectFit: 'contain', marginRight: 16, flexShrink: 0 }} />
          <img src={logoSrc} alt="" style={{ height: 42, width: 'auto', objectFit: 'contain', opacity: 0.9 }} />
        </div>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.10)',
          color: '#FFF',
          borderRadius: 9999, padding: '14px 30px',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          border: '1px solid rgba(255,255,255,0.12)',
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
              position: 'absolute', inset: -24,
              background: `radial-gradient(circle, ${theme.accent}30 0%, transparent 70%)`,
              filter: 'blur(50px)',
              zIndex: 0,
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              width: 480, height: 480,
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 28px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)',
            }}>
              <img src={coverSrc} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              }} />
            </div>
          </div>
        )}
        {/* Placeholder square in overlay mode (maintains layout positioning) */}
        {overlayOnly && (
          <div style={{ width: 480, height: 480, flexShrink: 0 }} />
        )}

        {/* Episode Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* "Now Playing" label */}
          <div style={{
            fontFamily: headingFont,
            fontSize: 20, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: theme.accent, marginBottom: 24, opacity: 0.9,
          }}>
            Now Playing
          </div>

          {/* Podcast Title */}
          <h1 style={{
            fontFamily: headingFont,
            fontSize: getPodcastTitleFontSize(title.length),
            fontWeight: 800, lineHeight: 1.06,
            margin: 0, marginBottom: 20,
            color: '#FFFFFF',
          }}>
            {title}
          </h1>

          {/* Episode subtitle / article title */}
          {subtitle && (
            <p style={{
              fontSize: 32, fontWeight: 400, lineHeight: 1.35,
              color: 'rgba(255,255,255,0.55)', margin: 0, marginBottom: 16,
              maxWidth: 780,
            }}>
              {subtitle}
            </p>
          )}

          {/* Guest / Host name */}
          {guestName && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              marginTop: 6,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: 9999,
                backgroundColor: theme.accent, opacity: 0.6,
              }} />
              <span style={{
                fontSize: 26, fontWeight: 500, letterSpacing: '0.02em',
                color: 'rgba(255,255,255,0.5)',
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
                  width: Math.max(2, Math.floor((W - PAD_X * 2) / waveformBars.length) - 2),
                  height: Math.max(4, barH),
                  borderRadius: 2,
                  backgroundColor: overlayOnly
                    ? 'rgba(255,255,255,0.12)'
                    : isBeforeProgress
                      ? theme.accent
                      : 'rgba(255,255,255,0.15)',
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
              width: '100%', height: 7, borderRadius: 9999,
              backgroundColor: 'rgba(255,255,255,0.1)',
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
            fontSize: 24, fontWeight: 500, color: 'rgba(255,255,255,0.35)',
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
