// ─── Instagram Caption & Hashtag Generator ───
// Template-based caption generation from article data. No external AI APIs.

import CONFIG from '../config';

// ── Hashtag Pool ──
// Mapped from common Ghost tag slugs + BeatPass niche keywords
const TAG_HASHTAG_MAP = {
  'beats': ['#beats', '#beatmaker', '#beatsforsale', '#instrumentals'],
  'beat-leases': ['#beatlease', '#beatleasing', '#beatsforsale', '#exclusivebeats'],
  'music-production': ['#musicproduction', '#musicproducer', '#producerlife', '#beatmaking'],
  'type-beats': ['#typebeat', '#typebeats', '#typebeatproducer'],
  'hip-hop': ['#hiphop', '#hiphopbeats', '#rap', '#rapbeats'],
  'recording': ['#recording', '#homestudio', '#recordingartist', '#studiolife'],
  'mixing': ['#mixing', '#mastering', '#mixengineer', '#audioengineer'],
  'songwriting': ['#songwriting', '#songwriter', '#lyrics', '#writingmusic'],
  'marketing': ['#musicmarketing', '#musicpromotion', '#independentartist'],
  'spotify': ['#spotify', '#spotifyplaylist', '#spotifyartist', '#streaming'],
  'youtube': ['#youtube', '#youtubemusic', '#contentcreator'],
  'tiktok': ['#tiktok', '#tiktokmusic', '#viral'],
  'copyright': ['#musiccopyright', '#musicrights', '#musicbusiness'],
  'free-beats': ['#freebeats', '#freebeat', '#freeinstrumentals'],
  'daw': ['#daw', '#flstudio', '#ableton', '#logicpro'],
  'sampling': ['#sampling', '#sampleclearance', '#musicsamples'],
  'branding': ['#musicbranding', '#artistbranding', '#personalbranding'],
  'income': ['#passiveincome', '#musicincome', '#makemoneymusic'],
};

const BRAND_HASHTAGS = ['#beatpass', '#beatpassca'];

const UNIVERSAL_HASHTAGS = [
  '#musicproduction', '#beats', '#producer', '#musicproducer',
  '#beatmaker', '#hiphopbeats', '#instrumentals', '#producerlife',
];

// ── Hook Line Templates ──
const HOOK_TEMPLATES = [
  (title) => `🔥 ${title}`,
  (title) => `Stop making this mistake → ${title}`,
  (title) => `Here's what nobody tells you about ${title.toLowerCase()}`,
  (title) => `${title} — and why it matters more than you think`,
  (title) => `📌 Save this: ${title}`,
  (title) => `The truth about ${title.toLowerCase()}`,
  (title) => `Want to level up? ${title}`,
];

// ── CTA Templates ──
const CTA_TEMPLATES = [
  '👉 Link in bio for the full article\n💾 Save this for later\n🔔 Follow @beatpass for more',
  '📖 Read the full breakdown — link in bio\n💬 Drop a comment if this helped\n🔁 Share with a friend who needs this',
  '🔗 Full article in bio\n❤️ Like if you found this useful\n📌 Save for reference',
  '➡️ Link in bio to read more\n💡 Tag someone who needs to see this\n🔔 Follow for daily music tips',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const truncate = (text, limit) => {
  if (!text || text.length <= limit) return text || '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let result = '';
  for (const s of sentences) {
    if ((result + s).length > limit && result.length > 0) break;
    result += s;
  }
  return result.trim() || text.substring(0, limit).replace(/\s+\S*$/, '').trim();
};

// Extract key phrases from title for body text
const extractKeyPhrases = (title) => {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'in', 'on', 'at', 'and', 'or', 'but', 'how', 'what', 'why', 'your', 'you', 'with']);
  return (title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
};

// Build hashtag set from article tags + title keywords
const buildHashtags = (article, maxCount = 18) => {
  const tags = new Set();

  // Brand hashtags always included
  for (const h of BRAND_HASHTAGS) tags.add(h);

  // Build article tag slugs with explicit loop (CodeRabbit #8)
  const rawTags = article.tags || [];
  const articleTags = [];
  for (const t of rawTags) {
    articleTags.push(typeof t === 'object' ? t.slug : t);
  }

  for (const slug of articleTags) {
    if (slug.startsWith('hash-')) continue; // skip internal tags
    const mapped = TAG_HASHTAG_MAP[slug];
    if (mapped) {
      for (const h of mapped) tags.add(h);
    } else {
      tags.add(`#${slug.replace(/-/g, '')}`);
    }
  }

  // Add universal hashtags to fill up
  for (const h of UNIVERSAL_HASHTAGS) {
    if (tags.size >= maxCount) break;
    tags.add(h);
  }

  // Extract keywords from title for extra hashtags
  const titleWords = extractKeyPhrases(article.title);
  for (const w of titleWords) {
    if (tags.size >= maxCount) break;
    const tag = `#${w.replace(/[^a-z0-9]/g, '')}`;
    if (tag.length > 3) tags.add(tag);
  }

  return Array.from(tags).slice(0, maxCount).join(' ');
};

// Build body text from article excerpt and slide titles
const buildBody = (article, slides = []) => {
  const parts = [];

  // Use excerpt as primary body
  if (article.excerpt && article.excerpt.length > 20) {
    parts.push(truncate(article.excerpt, 300));
  }

  // Add slide titles as key points (if enough slides)
  const contentSlides = slides.filter(s => s.type === 'content');
  if (contentSlides.length >= 2) {
    const points = contentSlides
      .slice(0, 4)
      .map(s => `✅ ${s.title}`)
      .join('\n');
    parts.push(points);
  }

  return parts.join('\n\n');
};

export const generateCaption = (article, slides = []) => {
  if (!article) return { hook: '', body: '', cta: '', hashtags: '' };

  const title = article.title || 'Untitled';

  return {
    hook: pick(HOOK_TEMPLATES)(truncate(title, 80)),
    body: buildBody(article, slides),
    cta: pick(CTA_TEMPLATES),
    hashtags: buildHashtags(article),
  };
};
