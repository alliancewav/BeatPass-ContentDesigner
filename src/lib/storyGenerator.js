// ─── Story Frame Generator ───
// Produces up to 6 Instagram Story frames (1080×1920, 9:16) from article data:
// hook, teaser, quote (if available), tip (if available), poll, cta.
// Designed to complement the carousel slides with engaging hook-style content.
// Icons are stored as string names (e.g. 'flame') and resolved in StoryCanvas.

import CONFIG from '../config';

// ── Unique ID generator (C3: avoids Date.now() collisions) ──
let _counter = 0;
const uid = (prefix) => {
  _counter++;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${_counter}-${Math.random().toString(36).slice(2, 8)}`;
};

// ── Hook templates — icon names instead of emojis ──
const HOOK_TEMPLATES = [
  { fn: (title) => `Did you know?\n${title}`, icon: 'alertCircle' },
  { fn: (title) => `Stop scrolling.\n${title}`, icon: 'eye' },
  { fn: (title) => `${title}\n\nHere's what you need to know`, icon: 'arrowDown' },
  { fn: (title) => `Most people get this wrong.\n\n${title}`, icon: 'zap' },
  { fn: (title) => title, icon: 'flame' },
  { fn: (title) => `Here's the truth about\n${title.toLowerCase()}`, icon: 'sparkles' },
  { fn: (title) => `Save this.\n\n${title}`, icon: 'bookmark' },
  { fn: (title) => `Nobody talks about this:\n\n${title}`, icon: 'messageCircle' },
  { fn: (title) => `If you produce beats, read this.\n\n${title}`, icon: 'music' },
  { fn: (title) => `New article just dropped.\n\n${title}`, icon: 'bell' },
  { fn: (title) => `Bookmark this one.\n\n${title}`, icon: 'bookmark' },
  { fn: (title) => `This one's for the producers:\n\n${title}`, icon: 'headphones' },
  { fn: (title) => `Swipe to learn:\n\n${title}`, icon: 'arrowRight' },
];

// Short-title-safe hooks (titles < 10 chars get simpler templates)
const SHORT_HOOK_TEMPLATES = [
  { fn: (title) => title, icon: 'flame' },
  { fn: (title) => `Let's talk about\n${title}`, icon: 'sparkles' },
  { fn: (title) => `New post:\n${title}`, icon: 'bell' },
  { fn: (title) => `Drop everything.\n\n${title}`, icon: 'zap' },
  { fn: (title) => `Save this.\n\n${title}`, icon: 'bookmark' },
];

const TEASER_TEMPLATES = [
  (excerpt) => excerpt,
  (excerpt) => `Here's the quick version:\n\n${excerpt}`,
  (excerpt) => `The short version:\n\n${excerpt}`,
  (excerpt) => `Here's what we cover:\n\n${excerpt}`,
];

const CTA_LABELS = [
  { label: 'See our new carousel post', icon: 'arrowRight', ctaIcon: 'arrowRight' },
  { label: 'Swipe up for the full article', icon: 'megaphone', ctaIcon: 'chevronUp' },
  { label: 'New post — check it out!', icon: 'star', ctaIcon: 'chevronUp' },
  { label: 'Link in bio for more', icon: 'link2', ctaIcon: 'link2' },
  { label: 'Read the full breakdown', icon: 'bookOpen', ctaIcon: 'arrowRight' },
  { label: 'Tap to see the full guide', icon: 'arrowRight', ctaIcon: 'arrowRight' },
  { label: 'Check out the new post', icon: 'star', ctaIcon: 'chevronUp' },
];

const POLL_TEMPLATES = [
  { question: (title) => `Do you know about\n${title}?`, options: ['Yes!', 'Not yet'] },
  { question: (title) => `Have you tried this?\n${title}`, options: ['Already on it', 'Tell me more'] },
  { question: () => 'What do you want to learn next?', options: ['Production tips', 'Marketing'] },
  { question: (title) => `How well do you know\n${title}?`, options: ['Expert level', 'Still learning'] },
  { question: () => 'Which matters more to you?', options: ['Quality', 'Speed'] },
  { question: (title) => `Is this a problem for you?\n${title}`, options: ['100% yes', 'Not really'] },
  { question: () => 'Would you share this with a friend?', options: ['Definitely!', 'Maybe later'] },
  { question: () => 'How do you prefer to learn?', options: ['Reading', 'Watching videos'] },
  { question: () => 'Are you working on this right now?', options: ['Yes, actively', 'Planning to'] },
  { question: (title) => `Did you already know about\n${title}?`, options: ['Yep!', 'First I heard'] },
  { question: () => 'What DAW do you use?', options: ['FL Studio', 'Ableton'] },
  { question: () => 'How long have you been producing?', options: ['Under 2 years', '2+ years'] },
  { question: () => 'Do you sell beats online?', options: ['Yes!', 'Not yet'] },
  { question: () => 'How do you find beats to buy?', options: ['YouTube', 'Beat sites'] },
  { question: () => 'What holds you back most?', options: ['Time', 'Knowledge'] },
  { question: (title) => `Useful article?\n${title}`, options: ['Very useful!', 'Somewhat'] },
];

const TIP_LABELS = ['Key Points', 'Quick Tips', 'Pro Tips', 'Fast Facts', 'Remember This'];
const TIP_ICONS = ['lightbulb', 'zap', 'star', 'checkCircle', 'sparkles'];
const CTA_HEADLINES = ['New Post!', 'Just Dropped!', 'New Article!', 'Read This!', 'Check It Out!'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const truncate = (text, limit) => {
  if (!text || text.length <= limit) return text || '';
  // Prefer ending at a sentence boundary within limit
  const chunk = text.substring(0, limit);
  const sentenceEnd = chunk.match(/^(.*[.!?])\s/s);
  if (sentenceEnd && sentenceEnd[1].length > 20) return sentenceEnd[1].trim();
  // Fall back to word boundary — no ellipsis (preserves context)
  const cut = chunk.replace(/\s+\S*$/, '').trim();
  return cut || chunk;
};

// ── Blank story defaults — must be defined before generateStories ──
const blankStoryDefaults = {
  headline:    { hook: 'Your headline here', cta: 'New Post!', quote: 'Your quote here', tip: 'Your tip headline' },
  icon:        { hook: 'flame', cta: 'megaphone', poll: 'messageCircle', quote: 'messageCircle', tip: 'lightbulb' },
  ctaLabel:    { cta: 'Link in bio' },
  ctaIcon:     { cta: 'link2' },
  pollOptions: { poll: ['Option A', 'Option B'] },
  swipeHint:   { hook: 'Swipe for more' },
  domain:      { cta: CONFIG.brand.domain },
};

export const createBlankStory = (type = 'hook') => ({
  id: uid('story-blank'),
  type,
  headline: blankStoryDefaults.headline[type] || 'Your content',
  subtext: type === 'cta' ? 'Check out our latest content' : '',
  icon: blankStoryDefaults.icon[type] || 'lightbulb',
  image: null,
  ctaLabel: blankStoryDefaults.ctaLabel[type] || '',
  ctaIcon: blankStoryDefaults.ctaIcon[type] || null,
  pollOptions: blankStoryDefaults.pollOptions[type] || null,
  swipeHint: blankStoryDefaults.swipeHint[type] || '',
  domain: blankStoryDefaults.domain[type] || '',
});

export const generateStories = (article, slides = []) => {
  if (!article) return [createBlankStory('hook'), createBlankStory('cta')];

  const frames = [];
  const title = article.title || 'Untitled';
  const excerpt = article.excerpt || '';
  const tag = article.primaryTag || CONFIG.brand.name;
  const isShortTitle = title.length < 10;

  // 1. Hook frame — bold attention-grabber
  const hookTpl = pick(isShortTitle ? SHORT_HOOK_TEMPLATES : HOOK_TEMPLATES);
  frames.push({
    id: uid('story-hook'),
    type: 'hook',
    headline: hookTpl.fn(truncate(title, 80)),
    subtext: tag,
    icon: hookTpl.icon,
    image: article.featureImage || null,
    ctaLabel: '',
    ctaIcon: null,
    pollOptions: null,
    swipeHint: 'Swipe for more',
  });

  // 2. Teaser frame — key insight from excerpt or slide-title bullet points
  if (excerpt.length > 20 || slides.length >= 4) {
    const contentSlides = slides.filter(s => s.type === 'content' && !s.isContinuation && s.title);
    const teaserBullets = contentSlides.length >= 3
      ? contentSlides.slice(0, 4).map(s => truncate(s.title, 55))
      : null;
    frames.push({
      id: uid('story-teaser'),
      type: 'teaser',
      headline: truncate(title, 60),
      subtext: teaserBullets ? '' : pick(TEASER_TEMPLATES)(truncate(excerpt, 200)),
      bullets: teaserBullets,
      icon: 'lightbulb',
      image: article.featureImage || null,
      ctaLabel: 'Read more in our carousel',
      ctaIcon: 'arrowRight',
      pollOptions: null,
    });
  }

  // 2b. Quote frame — auto-generated from first pull-quote callout slide (if available)
  const quoteSlide = slides.find(s => s.subtype === 'callout' && s.calloutIsQuote && (s.calloutText || s.content));
  if (quoteSlide) {
    frames.push({
      id: uid('story-quote'),
      type: 'quote',
      headline: truncate(quoteSlide.calloutText || quoteSlide.content || '', 160),
      subtext: quoteSlide.title && quoteSlide.title.length > 2 ? quoteSlide.title : article.primaryTag || '',
      icon: 'messageCircle',
      image: article.featureImage || null,
      ctaLabel: '',
      ctaIcon: null,
      pollOptions: null,
    });
  }

  // 2c. Tip frame — auto-generated from richest bullet slide (most bullets, if available)
  const bulletSlides = slides.filter(s => s.type === 'content' && s.bullets && s.bullets.length >= 2);
  const tipSlide = bulletSlides.reduce((best, s) => (s.bullets.length > (best?.bullets?.length || 0) ? s : best), null);
  if (tipSlide) {
    const tipBullets = tipSlide.bullets.slice(0, 3);
    const tipText = tipBullets.map(b => `• ${truncate(b, 60)}`).join('\n');
    frames.push({
      id: uid('story-tip'),
      type: 'tip',
      headline: truncate(tipSlide.title, 60),
      subtext: tipText,
      icon: pick(TIP_ICONS),
      tipLabel: pick(TIP_LABELS),
      image: article.featureImage || null,
      ctaLabel: '',
      ctaIcon: null,
      pollOptions: null,
    });
  }

  // 3. Poll frame — engagement
  const pollTpl = pick(POLL_TEMPLATES);
  frames.push({
    id: uid('story-poll'),
    type: 'poll',
    headline: pollTpl.question(truncate(title, 60)),
    subtext: '',
    icon: 'messageCircle',
    image: article.featureImage || null,
    ctaLabel: '',
    ctaIcon: null,
    pollOptions: [...pollTpl.options],
  });

  // 4. CTA frame — announcement
  const ctaTpl = pick(CTA_LABELS);
  frames.push({
    id: uid('story-cta'),
    type: 'cta',
    headline: pick(CTA_HEADLINES),
    subtext: truncate(title, 100),
    icon: ctaTpl.icon,
    image: article.featureImage || null,
    ctaLabel: ctaTpl.label,
    ctaIcon: ctaTpl.ctaIcon,
    pollOptions: null,
    domain: CONFIG.brand.domain,
  });

  return frames;
};
