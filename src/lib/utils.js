// ─── Utility Functions ───

// ── Color Parsing ──
const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
};

const rgbToHex = (r, g, b) =>
  `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;

// ── WCAG 2.1 Relative Luminance & Contrast ──
const sRGBtoLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export const relativeLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
};

export const contrastRatio = (hex1, hex2) => {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Returns 'light' or 'dark' text recommendation for a given background
export const wcagTextColor = (bgHex) => {
  const whiteContrast = contrastRatio(bgHex, '#FFFFFF');
  const blackContrast = contrastRatio(bgHex, '#000000');
  return whiteContrast >= blackContrast ? 'light' : 'dark';
};

// ── HSL ↔ RGB Conversion ──
const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
};

const hslToRgb = (h, s, l) => {
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
};

const hslToHexInternal = (h, s, l) => {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};

// Ensures text color meets WCAG contrast against bg.
// Incrementally adjusts fg lightness to preserve hue/saturation; only falls
// back to pure white/black if incremental adjustment can't reach the target.
export const ensureContrast = (bgHex, fgHex, minRatio = 4.5) => {
  if (contrastRatio(bgHex, fgHex) >= minRatio) return fgHex;

  const bgLum = relativeLuminance(bgHex);
  const isDarkBg = bgLum < 0.18;
  const { r, g, b } = hexToRgb(fgHex);
  const hsl = rgbToHsl(r, g, b);

  // Try adjusting lightness in 0.03 steps toward white (dark bg) or black (light bg)
  const dir = isDarkBg ? 0.03 : -0.03;
  let l = hsl.l;
  for (let i = 0; i < 30; i++) {
    l = Math.max(0, Math.min(1, l + dir));
    const candidate = hslToHexInternal(hsl.h, hsl.s, l);
    if (contrastRatio(bgHex, candidate) >= minRatio) return candidate;
  }

  // Fallback: pure white or black
  return isDarkBg ? '#FFFFFF' : '#000000';
};

// ── Dominant / Vibrant Color Extraction ──
// Uses median-cut quantization on a 100×100 sampled canvas.
// Clusters pixels into 8 color buckets, then scores each cluster
// by (frequency × vibrancy) to find the most representative vibrant color.
// Excludes near-edge pixels (top/bottom 8%) to avoid IG UI artifacts.
// Falls back to the largest cluster if no vibrant color is found.

// Median-cut quantization: split pixel list into 2^depth buckets
const medianCut = (pixels, depth) => {
  if (depth === 0 || pixels.length === 0) return [pixels];
  // Find channel with widest range
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const p of pixels) {
    if (p[0] < rMin) rMin = p[0]; if (p[0] > rMax) rMax = p[0];
    if (p[1] < gMin) gMin = p[1]; if (p[1] > gMax) gMax = p[1];
    if (p[2] < bMin) bMin = p[2]; if (p[2] > bMax) bMax = p[2];
  }
  const rRange = rMax - rMin, gRange = gMax - gMin, bRange = bMax - bMin;
  const ch = rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2;
  const sorted = pixels.slice().sort((a, b) => a[ch] - b[ch]);
  const mid = Math.floor(sorted.length / 2);
  return [
    ...medianCut(sorted.slice(0, mid), depth - 1),
    ...medianCut(sorted.slice(mid), depth - 1),
  ];
};

export const getDominantColor = async (imageSrc) => {
  const fallback = { r: 10, g: 10, b: 10, hex: '#0A0A0A' };
  try {
    let blobUrl = imageSrc;
    if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
      const res = await fetch(imageSrc, { mode: 'cors', credentials: 'same-origin' });
      if (!res.ok) return fallback;
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
    }

    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = blobUrl;
    });

    const SIZE = 100;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

    if (blobUrl !== imageSrc) URL.revokeObjectURL(blobUrl);

    // Collect pixels, excluding near-edge rows (top/bottom 8%) and
    // very dark (l < 0.05) / very bright (l > 0.95) pixels
    const edgeSkip = Math.round(SIZE * 0.08);
    const pixels = [];
    for (let y = edgeSkip; y < SIZE - edgeSkip; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = (y * SIZE + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const { l } = rgbToHsl(r, g, b);
        if (l < 0.05 || l > 0.95) continue;
        pixels.push([r, g, b]);
      }
    }

    if (pixels.length === 0) return fallback;

    // Quantize into 8 color clusters (depth=3 → 2³=8 buckets)
    const buckets = medianCut(pixels, 3);

    // Compute centroid and vibrancy score for each bucket
    let bestScore = -1;
    let bestColor = fallback;
    let largestCount = 0;
    let largestColor = fallback;

    for (const bucket of buckets) {
      if (bucket.length === 0) continue;
      let rSum = 0, gSum = 0, bSum = 0;
      for (const [r, g, b] of bucket) { rSum += r; gSum += g; bSum += b; }
      const count = bucket.length;
      const avgR = Math.round(rSum / count);
      const avgG = Math.round(gSum / count);
      const avgB = Math.round(bSum / count);
      const { h, s, l } = rgbToHsl(avgR, avgG, avgB);

      // Track largest bucket as fallback (most representative overall color)
      if (count > largestCount) {
        largestCount = count;
        largestColor = { r: avgR, g: avgG, b: avgB, hex: rgbToHex(avgR, avgG, avgB) };
      }

      // Vibrancy score: saturation × lightness-proximity-to-midrange × frequency weight
      // Wider lightness acceptance range (0.15–0.85) avoids rejecting good colors
      if (l < 0.10 || l > 0.90) continue;
      const lightnessScore = 1 - Math.pow(Math.abs(l - 0.50) * 1.6, 2);
      const freqWeight = Math.min(1, count / (pixels.length * 0.05)); // normalize: 5% of pixels = full weight
      const vibrancy = s * 0.55 + Math.max(0, lightnessScore) * 0.25 + freqWeight * 0.20;

      if (vibrancy > bestScore) {
        bestScore = vibrancy;
        bestColor = { r: avgR, g: avgG, b: avgB, hex: rgbToHex(avgR, avgG, avgB) };
      }
    }

    // Use vibrant color if score is meaningful, otherwise fall back to largest cluster
    return bestScore > 0.12 ? bestColor : largestColor;
  } catch (err) {
    console.warn('getDominantColor failed:', err);
    return fallback;
  }
};

export const hslToHex = (h, s, l) => {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};

export { rgbToHsl, hslToRgb };

// ── Color Manipulation ──
export const lightenColor = (hex, percent) => {
  const { r, g, b } = hexToRgb(hex);
  const amt = 2.55 * percent;
  return rgbToHex(Math.min(255, r + amt), Math.min(255, g + amt), Math.min(255, b + amt));
};

export const darkenColor = (hex, percent) => {
  const { r, g, b } = hexToRgb(hex);
  const amt = 2.55 * percent;
  return rgbToHex(Math.max(0, r - amt), Math.max(0, g - amt), Math.max(0, b - amt));
};

export const splitContentIntoChunks = (text, limit = 320) => {
  if (!text || text.length <= limit) return [text || ''];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = -1;
    const sentenceEnd = remaining.substring(0, limit).match(/[.!?]\s+(?=[A-Z])/g);
    if (sentenceEnd) {
      const lastMatch = sentenceEnd[sentenceEnd.length - 1];
      splitIndex = remaining.substring(0, limit).lastIndexOf(lastMatch) + 1;
    }
    if (splitIndex <= 0) splitIndex = remaining.substring(0, limit).lastIndexOf('. ');
    if (splitIndex <= 0) splitIndex = remaining.substring(0, limit).lastIndexOf(' ');
    if (splitIndex <= 0) splitIndex = limit;
    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }
  return chunks;
};

export const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const extractSlugFromUrl = (url) => {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/|\/$/g, '');
    return path;
  } catch {
    return url.replace(/^\/|\/$/g, '');
  }
};
