// ─── Content Designer Configuration ───
// Edit these values to customize the app for your Ghost blog.
// This file is the ONLY thing you need to change when moving to a new domain.

// Vite base path — '/' in dev, './' in production build
const BASE = import.meta.env.BASE_URL;

const CONFIG = {
  // Ghost Content API
  ghost: {
    apiUrl: 'https://blog.beatpass.ca',
    contentApiKey: '38b0205ed59052aea9f0e7a577',
  },

  // Password protection (SHA-256 hash of the password)
  // Default password: "beatpass2026"
  // To change: run in browser console:
  //   crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_PASSWORD'))
  //     .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''))
  //     .then(console.log)
  auth: {
    passwordHash: '971f6ab1fc1d547f2a7c4fc694688386ba920f00a6ae8e6733ff70fafce95264',
    sessionKey: 'bp-content-designer-auth',
  },

  // Branding
  brand: {
    name: 'BeatPass',
    domain: 'blog.beatpass.ca',
    // Logos bundled locally in public/logos/ — uses Vite BASE_URL for correct resolution
    favicon: `${BASE}logos/favicon.png`,
    logoWhite: `${BASE}logos/logo-white.png`,
    logoBlack: `${BASE}logos/logo-black.png`,
    accentColor: '#034D75',
  },

  // Slide defaults
  slides: {
    maxSlides: 10,
    targetContentSlides: { min: 4, max: 7 },
    contentCharLimit: 200,
    bulletCharLimit: 120,
    maxBulletsPerSlide: 3,
    maxImageSlides: 2,
    maxTitleLen: 65,
    bulletTitleThreshold: 36,
    wordsPerMinute: 275,
  },
};

export default CONFIG;
