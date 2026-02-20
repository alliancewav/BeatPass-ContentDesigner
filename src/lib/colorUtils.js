// ─── Color Utilities ───
// Safe color manipulation helpers that handle hex (3/4/6/8-digit),
// rgb(), rgba(), hsl(), hsla() inputs without external dependencies.

/**
 * Parse any CSS color string into { r, g, b, a } (0-255 for rgb, 0-1 for a).
 * Returns null if the format is unrecognised.
 */
function parseColor(color) {
  if (!color || typeof color !== 'string') return null;
  const c = color.trim();

  // rgb(a) functional notation
  const rgbMatch = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // hsl(a) — convert to rgb
  const hslMatch = c.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
    const { r, g, b } = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  // Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  const hex = c.startsWith('#') ? c.slice(1) : null;
  if (hex) {
    if (hex.length === 3) {
      return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: 1 };
    }
    if (hex.length === 4) {
      return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: parseInt(hex[3] + hex[3], 16) / 255 };
    }
    if (hex.length === 6) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
    }
    if (hex.length === 8) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: parseInt(hex.slice(6, 8), 16) / 255 };
    }
  }

  return null;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/**
 * Apply an alpha value (0-1) to any CSS color string.
 * Returns a valid `rgba(r,g,b,a)` string, or the original color as fallback.
 */
export function withAlpha(color, alpha) {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${parsed.r},${parsed.g},${parsed.b},${a})`;
}

/**
 * Apply a hex-style alpha suffix (e.g. 'C0', '1A') to any CSS color string.
 * Converts the hex alpha to 0-1 range and delegates to withAlpha.
 */
export function withHexAlpha(color, hexAlpha) {
  const alphaValue = parseInt(hexAlpha, 16) / 255;
  return withAlpha(color, alphaValue);
}

/**
 * Responsive font size helper: given a length and a list of [maxLen, fontSize]
 * breakpoints (ascending by maxLen), returns the fontSize for the first
 * breakpoint where length < maxLen, or the last fontSize as fallback.
 */
export function responsiveFontSize(length, breakpoints) {
  for (const [maxLen, size] of breakpoints) {
    if (length < maxLen) return size;
  }
  return breakpoints[breakpoints.length - 1][1];
}
