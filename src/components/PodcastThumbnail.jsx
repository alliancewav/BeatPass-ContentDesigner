// ─── Podcast YouTube Thumbnail ───
// 1280×720 landscape thumbnail for YouTube.
// "Split Stage" layout: prominent cover art left, bold episode text right.
// Full-bleed blurred cover art background with dark/theme overlay.
// Episode subtitle (article title) is the hero text; show title is secondary.
// All colours from `theme.*` — never hardcoded (shadows derive opacity from theme.bg).

import React from 'react';
import { Radio } from 'lucide-react';
import { withAlpha, responsiveFontSize } from '../lib/colorUtils';
import CONFIG from '../config';

export const THUMB_W = 1280;
export const THUMB_H = 720;


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
    siteUrl = CONFIG.brand.domain,
  } = podcastMeta;

  const headingFont = "'JetBrains Mono', 'Geist', monospace";
  const bodyFont = "'Roboto', 'Geist', system-ui, -apple-system, sans-serif";

  const usesDarkBg = theme.logoVariant === 'light';
  const logoSrc = usesDarkBg ? imageCache.logoWhite : imageCache.logoBlack;
  const coverSrc = coverImage || imageCache.cover;

  // Layout
  const PAD_X = 68;
  const PAD_TOP = 36;
  const COVER_SIZE = 440;
  const COVER_LEFT = PAD_X;
  const COVER_TOP = (THUMB_H - COVER_SIZE) / 2 - 10;
  const TEXT_LEFT = COVER_LEFT + COVER_SIZE + 60;
  // TEXT_WIDTH = THUMB_W - TEXT_LEFT - PAD_X = 1280 - 568 - 68 = 644
  const TEXT_WIDTH = THUMB_W - TEXT_LEFT - PAD_X;

  const epStr = String(episodeNumber).padStart(2, '0');

  // Subtitle font size — scales with length, tuned for right-zone width (~644px)
  const sl = subtitle ? subtitle.length : 0;
  const subtitleFontSize = responsiveFontSize(sl, [[24,66],[40,56],[58,46],[80,38],[Infinity,32]]);

  // Title (show name) font size when used as fallback primary (no subtitle)
  const tl = title.length;
  const titleOnlyFontSize = responsiveFontSize(tl, [[16,78],[26,66],[38,54],[52,44],[Infinity,36]]);

  // Cover drop shadow — derived from theme.bg
  const coverShadow = usesDarkBg
    ? `0 12px 64px ${withAlpha(theme.bg, 0.72)}`
    : `0 8px 40px ${withAlpha(theme.bg, 0.32)}`;

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
      }}
    >
      {/* ── Full-bleed blurred cover art background ── */}
      {coverSrc && (
        <img
          src={coverSrc}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', filter: 'blur(60px) saturate(1.2)', transform: 'scale(1.15)',
            zIndex: 0,
          }}
        />
      )}

      {/* ── Overlay ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: usesDarkBg
          ? `linear-gradient(135deg, ${withAlpha(theme.bg, 0.70)} 0%, ${withAlpha(theme.bg, 0.80)} 100%)`
          : `linear-gradient(135deg, ${withAlpha(theme.bg, 0.75)} 0%, ${withAlpha(theme.bg, 0.88)} 100%)`,
      }} />

      {/* ── Cover art (left, clean — no ring) ── */}
      <div style={{
        position: 'absolute',
        left: COVER_LEFT, top: COVER_TOP,
        width: COVER_SIZE, height: COVER_SIZE,
        zIndex: 5,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: coverShadow,
      }}>
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            backgroundColor: withAlpha(theme.accent, 0.094),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Radio size={88} color={theme.accent} opacity={0.35} />
          </div>
        )}
      </div>

      {/* ── Text zone (right of cover art) ── */}
      <div style={{
        position: 'absolute',
        left: TEXT_LEFT, top: 0,
        width: TEXT_WIDTH,
        height: THUMB_H,
        zIndex: 5,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        boxSizing: 'border-box',
      }}>
        {/* EP label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 32, height: 2.5, borderRadius: 9999, backgroundColor: theme.accent }} />
          <span style={{
            fontFamily: headingFont,
            fontSize: 13, fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: theme.accent,
          }}>
            PODCAST &nbsp;·&nbsp; EP {epStr}
          </span>
        </div>

        {/* Episode subtitle (PRIMARY hero text) — article title */}
        {subtitle ? (
          <h1 style={{
            fontFamily: headingFont,
            fontSize: subtitleFontSize,
            fontWeight: 800, lineHeight: 1.1,
            margin: 0, marginBottom: 22,
            letterSpacing: '-0.02em',
            color: theme.text,
            wordBreak: 'break-word',
          }}>
            {subtitle}
          </h1>
        ) : (
          /* Fallback: show title as primary when no subtitle */
          <h1 style={{
            fontFamily: headingFont,
            fontSize: titleOnlyFontSize,
            fontWeight: 800, lineHeight: 1.05,
            margin: 0, marginBottom: 0,
            letterSpacing: '-0.02em',
            color: theme.text,
            wordBreak: 'break-word',
          }}>
            {title}
          </h1>
        )}

        {/* Show title (SECONDARY) — only shown when subtitle is present */}
        {subtitle && (
          <p style={{
            fontFamily: bodyFont,
            fontSize: 20, fontWeight: 500, lineHeight: 1.35,
            margin: 0,
            color: theme.muted,
            opacity: 0.72,
            letterSpacing: '0.01em',
          }}>
            {title}
          </p>
        )}

        {/* Guest name */}
        {guestName && (
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 1.5, backgroundColor: theme.accent, opacity: 0.6 }} />
            <span style={{ fontFamily: bodyFont, fontSize: 18, fontWeight: 600, color: theme.accent }}>
              {guestName}
            </span>
          </div>
        )}
      </div>

      {/* ── Header: logo left, site url right ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `${PAD_TOP}px ${PAD_X}px 0`,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={imageCache.favicon} alt=""
            style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }}
          />
          <img
            src={logoSrc} alt=""
            style={{ height: 22, width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <span style={{
          fontFamily: headingFont, fontSize: 12, fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: theme.muted, opacity: 0.55,
        }}>
          {siteUrl}
        </span>
      </div>
    </div>
  );
}
