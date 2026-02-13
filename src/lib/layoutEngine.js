// ─── Pixel-Budget Layout Engine ───
// Every constant is derived from canvas geometry — zero guesswork.
// Square (1:1) is the binding constraint; portrait gets extra breathing room.

// ── Canvas Geometry ──
const CANVAS_W = 1080;
const SIDE_PAD = 72;                          // horizontal padding each side
const USABLE_W = CANVAS_W - SIDE_PAD * 2;    // 936px

const TOP_CHROME  = 160;   // header (100px) + breathing gap (60px)
const BOT_CHROME  = 120;   // progress bar area (46px) + breathing gap (74px)

const PORTRAIT_H  = 1350;
const SQUARE_H    = 1080;

const PORTRAIT_USABLE = PORTRAIT_H - TOP_CHROME - BOT_CHROME;  // 1070px
const SQUARE_USABLE   = SQUARE_H   - TOP_CHROME - BOT_CHROME;  //  800px

// ── Font Metrics ──
// Measured character-width ratios (avg English text):
//   JetBrains Mono (monospace): 0.6 × fontSize
//   Roboto (proportional):      0.47 × fontSize
const MONO_CW_RATIO = 0.6;
const SANS_CW_RATIO = 0.47;

const charsPerLine = (fontSize, family = 'sans', width = USABLE_W) =>
  Math.floor(width / (fontSize * (family === 'mono' ? MONO_CW_RATIO : SANS_CW_RATIO)));

const textLines = (charCount, fontSize, family = 'sans', width = USABLE_W) =>
  Math.ceil(charCount / charsPerLine(fontSize, family, width));

const textHeight = (charCount, fontSize, lineHeight, family = 'sans') =>
  textLines(charCount, fontSize, family) * fontSize * lineHeight;

// ── Element Constants ──
const ACCENT_BAR   = 4;    // bar height
const ACCENT_MT    = 20;   // margin-top
const ACCENT_MB    = 24;   // margin-bottom
const ACCENT_TOTAL = ACCENT_BAR + ACCENT_MT + ACCENT_MB;  // 48px

const BULLET_DOT_W = 36;   // dot (12px) + gap (18px) + breathing (6px)
const BULLET_GAP   = 20;   // vertical gap between bullet items

// ── Title Sizing ──
// Budget for 3 title lines to avoid aggressive truncation that destroys context.
// At 64px mono: 24 chars/line. 3 lines = 72 chars max.
// At 72px mono: 21 chars/line. 3 lines = 63 chars max (portrait binding).
const TITLE_FONT_SQUARE   = 64;
const TITLE_FONT_PORTRAIT = 72;
const TITLE_LH = 1.1;

// Max chars: 3 lines at portrait font (72px, 21 CPL) = 63 chars
const TITLE_MAX_CHARS = charsPerLine(TITLE_FONT_PORTRAIT, 'mono') * 3;  // 21 × 3 = 63

const titleHeight = (charCount, fontSize) => {
  const lines = Math.min(textLines(charCount, fontSize, 'mono'), 3); // clamp at 3 for safety
  return lines * fontSize * TITLE_LH;
};

// ── Body Text ──
const BODY_FONT   = 38;
const BODY_LH     = 1.5;
const BODY_CPL    = charsPerLine(BODY_FONT, 'sans');  // ~52

// ── Bullet Text ──
const BULLET_FONT = 36;
const BULLET_LH   = 1.45;
const BULLET_EFFECTIVE_W = USABLE_W - BULLET_DOT_W;  // 900px
const BULLET_CPL  = charsPerLine(BULLET_FONT, 'sans', BULLET_EFFECTIVE_W);  // ~53

// ── Intro Text (paragraph above bullets) ──
const INTRO_FONT  = 36;
const INTRO_LH    = 1.45;
const INTRO_MB    = 20;   // margin-bottom before bullets
const INTRO_CPL   = charsPerLine(INTRO_FONT, 'sans');  // ~53

// ── Derived Content Limits (square = binding constraint) ──
// Available after title (2 lines) + accent = 800 - 160 - 48 = 592px

const squareTitleH  = titleHeight(TITLE_MAX_CHARS, TITLE_FONT_SQUARE);  // 160px
const availAfterTitle = SQUARE_USABLE - squareTitleH - ACCENT_TOTAL;     // 592px

// Type A: Text-only → max body chars
const bodyMaxLines = Math.floor(availAfterTitle / (BODY_FONT * BODY_LH));
const bodyMaxChars = bodyMaxLines * BODY_CPL;
const CONTENT_CHAR_LIMIT = Math.floor(bodyMaxChars * 0.95);  // 5% safety → ~494 → 490

// Type B: Bullets-only (no intro) → max bullet count
const bulletItemHeight = (charLimit) => {
  const lines = Math.ceil(charLimit / BULLET_CPL);
  return lines * BULLET_FONT * BULLET_LH + BULLET_GAP;
};
const BULLET_CHAR_LIMIT = 140;  // at 140ch: ceil(140/53) = 3 lines → 177px
const MAX_BULLETS_NO_INTRO = Math.floor(availAfterTitle / bulletItemHeight(BULLET_CHAR_LIMIT));  // 3

// Type C: Intro + bullets → intro eats into budget
const introMaxLines = 3;
const introHeight = introMaxLines * INTRO_FONT * INTRO_LH + INTRO_MB;  // ~177px
const INTRO_CHAR_LIMIT = introMaxLines * INTRO_CPL;  // ~159 → 155
const availAfterIntro = availAfterTitle - introHeight;  // ~415px
const MAX_BULLETS_WITH_INTRO = Math.floor(availAfterIntro / bulletItemHeight(BULLET_CHAR_LIMIT));  // 2

// ── Exported Static Limits (for slideGenerator — 'balanced' defaults) ──
export const LIMITS = {
  maxTitleLen: TITLE_MAX_CHARS,              // 63
  contentCharLimit: CONTENT_CHAR_LIMIT,      // ~490
  bulletCharLimit: BULLET_CHAR_LIMIT,        // 140
  bulletIntroCharLimit: INTRO_CHAR_LIMIT,    // ~155
  maxBulletsNoIntro: MAX_BULLETS_NO_INTRO,   // 3
  maxBulletsWithIntro: MAX_BULLETS_WITH_INTRO, // 2
};

// ── Density Presets ──
// Each density mode adjusts slide-count targets and content limits.
// The pixel-budget formulas are reused — only the *fill targets* change.
export const DENSITY_PRESETS = {
  concise:  { label: 'Concise',  maxSlides: 7,  targetContentSlides: { min: 3, max: 5 }  },
  balanced: { label: 'Balanced', maxSlides: 15, targetContentSlides: { min: 5, max: 12 } },
  detailed: { label: 'Detailed', maxSlides: 20, targetContentSlides: { min: 9, max: 16 } },
};

// ── Density-aware Limits ──
// Scales content limits up/down while staying within pixel-budget safety.
// 'concise'  → fewer chars, fewer bullets → bolder, more impactful per slide
// 'balanced' → current defaults (unchanged)
// 'detailed' → more chars, more bullets → denser, more informative per slide
export const getLimitsForDensity = (density = 'balanced') => {
  if (density === 'concise') {
    // Shorter text → larger effective font feel, more whitespace
    const cBulletLimit = 100;
    const cBulletCPL = BULLET_CPL;
    const cBulletItemH = Math.ceil(cBulletLimit / cBulletCPL) * BULLET_FONT * BULLET_LH + BULLET_GAP;
    const cMaxBulletsNoIntro = Math.min(3, Math.floor(availAfterTitle / cBulletItemH));
    const cMaxBulletsWithIntro = Math.min(2, Math.floor((availAfterTitle - introHeight) / cBulletItemH));
    return {
      maxTitleLen: TITLE_MAX_CHARS,
      contentCharLimit: Math.floor(CONTENT_CHAR_LIMIT * 0.65),  // ~320 chars
      bulletCharLimit: cBulletLimit,
      bulletIntroCharLimit: Math.floor(INTRO_CHAR_LIMIT * 0.75), // ~120 chars
      maxBulletsNoIntro: cMaxBulletsNoIntro,
      maxBulletsWithIntro: cMaxBulletsWithIntro,
    };
  }
  if (density === 'detailed') {
    // More text allowed — fill the pixel budget more aggressively
    const dBulletLimit = 170;
    const dBulletCPL = BULLET_CPL;
    const dBulletItemH = Math.ceil(dBulletLimit / dBulletCPL) * BULLET_FONT * BULLET_LH + BULLET_GAP;
    const dMaxBulletsNoIntro = Math.floor(availAfterTitle / dBulletItemH);
    const dMaxBulletsWithIntro = Math.floor((availAfterTitle - introHeight) / dBulletItemH);
    return {
      maxTitleLen: TITLE_MAX_CHARS,
      contentCharLimit: Math.floor(CONTENT_CHAR_LIMIT * 1.15),  // ~565 chars
      bulletCharLimit: dBulletLimit,
      bulletIntroCharLimit: INTRO_CHAR_LIMIT,                    // unchanged
      maxBulletsNoIntro: Math.min(5, dMaxBulletsNoIntro),
      maxBulletsWithIntro: Math.min(3, dMaxBulletsWithIntro),
    };
  }
  // balanced — unchanged defaults
  return { ...LIMITS };
};

// ── Runtime Layout Calculator (for SlideCanvas) ──
export const computeLayout = (slide, isPortrait) => {
  const usableH  = isPortrait ? PORTRAIT_USABLE : SQUARE_USABLE;
  const titleFont = isPortrait ? TITLE_FONT_PORTRAIT : TITLE_FONT_SQUARE;
  const titleLen  = (slide.title || '').length;
  const titleH    = titleHeight(titleLen, titleFont);

  const contentLen  = (slide.content || '').length;
  const bulletCount = (slide.bullets || []).length;
  const hasBoth     = contentLen > 0 && bulletCount > 0;
  const isShort     = contentLen > 0 && contentLen < 120 && bulletCount === 0;

  // Per-slide font size override (delta in px, e.g. -4, 0, +4)
  const fso = slide.fontSizeOverride || 0;

  // Available height after title + accent
  const availH = usableH - titleH - ACCENT_TOTAL;

  // Body font: 38px standard, bump to 44px for short impactful text
  const bodyFont = ((isShort && !hasBoth) ? (isPortrait ? 46 : 42) : BODY_FONT) + fso;
  const bodyLH   = BODY_LH;

  const introFont  = INTRO_FONT + fso;
  const bulletFont = BULLET_FONT + fso;

  // Vertical alignment: center on portrait for short/medium content, top otherwise
  const totalContentH = contentLen > 0
    ? textHeight(contentLen, bodyFont, bodyLH)
    : 0;
  const totalBulletH = bulletCount > 0
    ? bulletCount * (Math.ceil(BULLET_CHAR_LIMIT / charsPerLine(bulletFont, 'sans', BULLET_EFFECTIVE_W)) * bulletFont * BULLET_LH + BULLET_GAP) - BULLET_GAP
    : 0;
  const introH = hasBoth ? textHeight(contentLen, introFont, INTRO_LH) + INTRO_MB : 0;
  const allContentH = titleH + ACCENT_TOTAL + (hasBoth ? introH + totalBulletH : totalContentH + totalBulletH);
  const fillRatio = allContentH / usableH;
  const verticalAlign = isPortrait && fillRatio < 0.7 ? 'center' : 'top';

  return {
    // Dimensions
    usableH,
    padTop: TOP_CHROME,
    padBottom: BOT_CHROME,
    // Title
    titleFontSize: titleFont,
    titleLineHeight: TITLE_LH,
    titleHeight: titleH,
    // Accent
    accentBarH: ACCENT_BAR,
    accentMarginTop: ACCENT_MT,
    accentMarginBottom: ACCENT_MB,
    // Body
    bodyFontSize: bodyFont,
    bodyLineHeight: bodyLH,
    // Intro (when both content + bullets)
    introFontSize: introFont,
    introLineHeight: INTRO_LH,
    introMarginBottom: INTRO_MB,
    // Bullets
    bulletFontSize: bulletFont,
    bulletLineHeight: BULLET_LH,
    bulletGap: BULLET_GAP,
    bulletDotSize: 12,
    // Layout
    verticalAlign,
    fillRatio,
    isShort,
  };
};
