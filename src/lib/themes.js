// ─── Theme Definitions ───
// Colors sourced from the Ghost CMS "aspect" theme (custom.css WCAG AAA overrides)
// Light: bg #FCFEFF, contrast #0F0F0F, foreground #2D2D2D, accent #034D75
// Dark:  bg #0A0A0A, contrast #E5E7EB, foreground #CBD5E1, accent #AFBDCF

const THEMES = {
  // Mirrors aspect dark theme exactly
  aspectDark: {
    id: 'aspectDark',
    name: 'Dark',
    preview: { bg: '#0A0A0A', fg: '#E5E7EB' },
    bg: '#0A0A0A',
    text: '#E5E7EB',
    accent: '#AFBDCF',
    accentBg: '#AFBDCF',
    accentText: '#0A2042',
    muted: '#A0AFC3',
    gradient: 'linear-gradient(180deg, #0A0A0A 0%, #050505 100%)',
    overlayGradient: () => 'linear-gradient(to top, #0A0A0A 15%, #0A0A0AE6 45%, transparent 100%)',
    logoVariant: 'light',
    cardBg: 'rgba(255,255,255,0.04)',
  },
  // Mirrors aspect light theme exactly
  aspectLight: {
    id: 'aspectLight',
    name: 'Light',
    preview: { bg: '#FCFEFF', fg: '#0F0F0F' },
    bg: '#FCFEFF',
    text: '#0F0F0F',
    accent: '#034D75',
    accentBg: '#034D75',
    accentText: '#F1F1F1',
    muted: '#414141',
    gradient: 'linear-gradient(180deg, #FCFEFF 0%, #F0F2F5 100%)',
    overlayGradient: () => 'linear-gradient(to top, #FCFEFF 15%, #FCFEFFE6 45%, transparent 100%)',
    logoVariant: 'dark',
    cardBg: 'rgba(0,0,0,0.03)',
  },
  // High-contrast mono for maximum readability
  monoContrast: {
    id: 'monoContrast',
    name: 'Contrast',
    preview: { bg: '#000000', fg: '#FFFFFF' },
    bg: '#000000',
    text: '#FFFFFF',
    accent: '#FFFFFF',
    accentBg: '#FFFFFF',
    accentText: '#000000',
    muted: '#B0B0B0',
    gradient: 'linear-gradient(180deg, #000000 0%, #000000 100%)',
    overlayGradient: () => 'linear-gradient(to top, #000000 15%, #000000E6 45%, transparent 100%)',
    logoVariant: 'light',
    cardBg: 'rgba(255,255,255,0.06)',
  },
  // Brand accent theme using Ghost accent color
  brandAccent: {
    id: 'brandAccent',
    name: 'Brand',
    preview: { bg: '#034D75', fg: '#FFFFFF' },
    bg: '#03273B',
    text: '#F1F5F9',
    accent: '#5BB8E8',
    accentBg: '#5BB8E8',
    accentText: '#03273B',
    muted: '#94A3B8',
    gradient: 'linear-gradient(135deg, #03273B 0%, #034D75 100%)',
    overlayGradient: () => 'linear-gradient(to top, #03273B 15%, #03273BE6 45%, transparent 100%)',
    logoVariant: 'light',
    cardBg: 'rgba(91,184,232,0.08)',
  },
  // Dynamic theme — colors computed at runtime from feature image
  smartMatch: {
    id: 'smartMatch',
    name: 'Auto',
    isDynamic: true,
    preview: { bg: '#333', fg: '#fff' },
    // Fallback values (overridden by dynamic computation)
    bg: '#0A0A0A',
    text: '#E5E7EB',
    accent: '#AFBDCF',
    accentBg: '#AFBDCF',
    accentText: '#0A0A0A',
    muted: '#A0AFC3',
    gradient: 'linear-gradient(180deg, #0A0A0A, #000000)',
    overlayGradient: (bg) => `linear-gradient(to top, ${bg || '#0A0A0A'} 15%, ${bg || '#0A0A0A'}E6 45%, transparent 100%)`,
    logoVariant: 'light',
    cardBg: 'rgba(255,255,255,0.06)',
  },
};

export default THEMES;
