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

// Ensures text color meets WCAG AA (4.5:1) against bg; adjusts if needed
export const ensureContrast = (bgHex, fgHex, minRatio = 4.5) => {
  const ratio = contrastRatio(bgHex, fgHex);
  if (ratio >= minRatio) return fgHex;
  // If contrast is insufficient, pick white or black
  const whiteRatio = contrastRatio(bgHex, '#FFFFFF');
  const blackRatio = contrastRatio(bgHex, '#000000');
  return whiteRatio >= blackRatio ? '#FFFFFF' : '#000000';
};

// ── Dominant / Vibrant Color Extraction ──
// Finds the most vibrant (saturated + mid-lightness) color from the image.
// Falls back to average if no colorful pixel is found.
// Uses fetch→blob→objectURL to guarantee a same-origin image (avoids canvas taint).

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

    const SIZE = 50;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

    if (blobUrl !== imageSrc) URL.revokeObjectURL(blobUrl);

    // Score each pixel: prefer saturated colors at mid-range lightness
    let bestScore = -1;
    let bestR = 10, bestG = 10, bestB = 10;
    let rSum = 0, gSum = 0, bSum = 0;
    const total = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      rSum += r; gSum += g; bSum += b;

      const { s, l } = rgbToHsl(r, g, b);
      // Skip very dark or very bright pixels
      if (l < 0.08 || l > 0.92) continue;
      // Score: saturation matters most, bonus for mid-range lightness
      const lightnessBonus = 1 - Math.abs(l - 0.45) * 1.5;
      const score = s * 0.7 + Math.max(0, lightnessBonus) * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestR = r; bestG = g; bestB = b;
      }
    }

    // If we found a sufficiently vibrant pixel, use it; else fall back to average
    if (bestScore > 0.15) {
      return { r: bestR, g: bestG, b: bestB, hex: rgbToHex(bestR, bestG, bestB) };
    }
    // Fallback: average color
    const r = Math.round(rSum / total);
    const g = Math.round(gSum / total);
    const b = Math.round(bSum / total);
    return { r, g, b, hex: rgbToHex(r, g, b) };
  } catch (err) {
    console.warn('getDominantColor failed:', err);
    return fallback;
  }
};

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
