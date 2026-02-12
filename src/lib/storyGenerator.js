// ─── Story Frame Generator ───
// Produces 2–4 Instagram Story frames (1080×1920, 9:16) from article data.
// Designed to complement the carousel slides with engaging hook-style content.
// Icons are stored as string names (e.g. 'flame') and resolved in StoryCanvas.

import CONFIG from '../config';

// ── Unique ID generator (C3: avoids Date.now() collisions) ──
let _counter = 0;
const uid = (prefix) => {
  _counter++;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${_counter}-${Math.random().toString(36).substr(2, 6)}`;
};

// ── Hook templates — icon names instead of emojis ──
const HOOK_TEMPLATES = [
  { fn: (title) => `Did you know?\n${title}`, icon: 'alertCircle' },
  { fn: (title) => `Stop scrolling.\n${title}`, icon: 'eye' },
  { fn: (title) => `${title}\n\nHere's what you need to know`, icon: 'arrowDown' },
  { fn: (title) => `Most people get this wrong.\n\n${title}`, icon: 'zap' },
  { fn: (title) => title, icon: 'flame' },
  { fn: (title) => `Here's the truth about\n${title.toLowerCase()}`, icon: 'sparkles' },
];

// Short-title-safe hooks (titles < 10 chars get simpler templates)
const SHORT_HOOK_TEMPLATES = [
  { fn: (title) => title, icon: 'flame' },
  { fn: (title) => `Let's talk about\n${title}`, icon: 'sparkles' },
];

const TEASER_TEMPLATES = [
  (excerpt) => excerpt,
  (excerpt) => `Here's the quick version:\n\n${excerpt}`,
];

const CTA_LABELS = [
  { label: 'See our new carousel post', icon: 'arrowRight', ctaIcon: 'arrowRight' },
  { label: 'Swipe up for the full article', icon: 'megaphone', ctaIcon: 'chevronUp' },
  { label: 'New post — check it out!', icon: 'star', ctaIcon: 'chevronUp' },
  { label: 'Link in bio for more', icon: 'link2', ctaIcon: 'link2' },
  { label: 'Read the full breakdown', icon: 'bookOpen', ctaIcon: 'arrowRight' },
];

const POLL_TEMPLATES = [
  { question: (title) => `Do you know about\n${title}?`, options: ['Yes!', 'Not yet'] },
  { question: (title) => `Have you tried this?\n${title}`, options: ['Already on it', 'Tell me more'] },
  { question: () => 'What do you want to learn next?', options: ['Production tips', 'Marketing'] },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const truncate = (text, limit) => {
  if (!text || text.length <= limit) return text || '';
  const cut = text.substring(0, limit).replace(/\s+\S*$/, '').trim();
  return (cut || text.substring(0, limit)) + '…';
};

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
  });

  // 2. Teaser frame — key insight from excerpt
  if (excerpt.length > 20) {
    frames.push({
      id: uid('story-teaser'),
      type: 'teaser',
      headline: truncate(title, 60),
      subtext: pick(TEASER_TEMPLATES)(truncate(excerpt, 200)),
      icon: 'lightbulb',
      image: article.featureImage || null,
      ctaLabel: 'Read more in our carousel',
      ctaIcon: 'arrowRight',
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
    headline: 'New Post!',
    subtext: truncate(title, 100),
    icon: ctaTpl.icon,
    image: article.featureImage || null,
    ctaLabel: ctaTpl.label,
    ctaIcon: ctaTpl.ctaIcon,
    pollOptions: null,
  });

  return frames;
};

export const createBlankStory = (type = 'hook') => ({
  id: uid('story-blank'),
  type,
  headline: type === 'hook' ? 'Your headline here' : type === 'cta' ? 'New Post!' : 'Your content',
  subtext: type === 'cta' ? 'Check out our latest content' : '',
  icon: type === 'hook' ? 'flame' : type === 'cta' ? 'megaphone' : type === 'poll' ? 'messageCircle' : 'lightbulb',
  image: null,
  ctaLabel: type === 'cta' ? 'Link in bio' : '',
  ctaIcon: type === 'cta' ? 'link2' : null,
  pollOptions: type === 'poll' ? ['Option A', 'Option B'] : null,
});
