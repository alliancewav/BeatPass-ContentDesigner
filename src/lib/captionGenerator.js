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
  'trap': ['#trap', '#trapbeats', '#trapmusic', '#trapproducer'],
  'rnb': ['#rnb', '#rnbbeats', '#soulmusic', '#rnbproducer'],
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
  'fl-studio': ['#flstudio', '#flstudiomobile', '#flstudio21'],
  'ableton': ['#ableton', '#abletonlive', '#liveset'],
  'logic-pro': ['#logicpro', '#logicprox', '#applelogic'],
  'sampling': ['#sampling', '#sampleclearance', '#musicsamples'],
  'branding': ['#musicbranding', '#artistbranding', '#personalbranding'],
  'income': ['#passiveincome', '#musicincome', '#makemoneymusic'],
  'licensing': ['#musiclicensing', '#synclicensing', '#musicrights'],
  'plugins': ['#vstplugins', '#musicplugins', '#synthhardware'],
  'loops': ['#loops', '#drumloops', '#samplepacks'],
  'podcast': ['#podcast', '#musicpodcast', '#podcastlife'],
  'artist': ['#artist', '#independentartist', '#unsignedartist'],
  'tips': ['#musictips', '#producertips', '#musicadvice'],
  'tutorial': ['#tutorial', '#musiclesson', '#learnmusic'],
  'gear': ['#musicgear', '#studiosetup', '#homerecording'],
  'collab': ['#musiccollab', '#producercollab', '#collaboration'],
  'ghostwriting': ['#ghostwriting', '#ghostwriter', '#songwritingservices'],
  'distribution': ['#musicdistribution', '#distrokid', '#tunecore', '#independentmusic'],
  'nft': ['#musicnft', '#nftmusic', '#cryptomusic'],
  'stem': ['#stems', '#stemfiles', '#trackstemfiles'],
  'vocal': ['#vocalproducer', '#vocals', '#vocalchops'],
  'sound-design': ['#sounddesign', '#synthesizer', '#modularsynthesizer'],
  'mixing-tips': ['#mixingtips', '#mixingtechniques', '#audiomixing'],
  'music-theory': ['#musictheory', '#chordprogressions', '#musicscales'],
  'drum-programming': ['#drumprogramming', '#beatmaking', '#drummachines'],
  'exclusive-beats': ['#exclusivebeats', '#buybeats', '#beatstore'],
  'music-business': ['#musicbusiness', '#musicindustry', '#musicentrepreneur'],
  'social-media': ['#socialmediaformusicians', '#musicmarketing', '#growthhacking'],
  'open-beatpass': ['#beatpass', '#openbeat', '#beatmarketplace'],
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
  (title) => `If you're serious about this, read → ${title}`,
  (title) => `💡 New post: ${title}`,
  (title) => `This changed how I think about ${title.toLowerCase()}`,
  (title) => `Most producers overlook this:\n\n${title}`,
  (title) => `Bookmark this.\n\n${title}`,
  (title) => `${title} 👇`,
  (title) => `🎯 ${title}`,
  (title) => `Read this before your next session:\n\n${title}`,
  (title) => `Nobody's talking about this enough:\n\n${title}`,
  (title) => `This one's for the producers →\n\n${title}`,
  (title) => `New article just dropped:\n\n${title}`,
  (title) => `${title}\n\nSave for later 💾`,
  (title) => `Let's talk about ${title.toLowerCase()} 👇`,
];

// ── CTA Templates ──
const CTA_TEMPLATES = [
  '👉 Link in bio for the full article\n💾 Save this for later\n🔔 Follow @beatpass for more',
  '📖 Read the full breakdown — link in bio\n💬 Drop a comment if this helped\n🔁 Share with a friend who needs this',
  '🔗 Full article in bio\n❤️ Like if you found this useful\n📌 Save for reference',
  '➡️ Link in bio to read more\n💡 Tag someone who needs to see this\n🔔 Follow for daily music tips',
  '🔖 Save this post for later\n💬 Was this helpful? Comment below!\n👥 Share with a producer who needs this',
];

const CTA_TEMPLATES_WITH_URL = [
  (url) => `👉 Read the full article:\n${url}\n\n💾 Save this · 🔔 Follow @beatpass`,
  (url) => `📖 Full breakdown here:\n${url}\n\n💬 Drop a comment if this helped`,
  (url) => `🔗 Read more:\n${url}\n\n❤️ Like · 📌 Save · 🔁 Share`,
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const truncate = (text, limit) => {
  if (!text || text.length <= limit) return text || '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let result = '';
  for (const s of sentences) {
    if ((result + s).length > limit) break;
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

  // Use excerpt as primary body; fall back to a short article title teaser
  if (article.excerpt && article.excerpt.length > 20) {
    parts.push(truncate(article.excerpt, 300));
  } else if (article.title) {
    parts.push(`Here's everything you need to know about ${article.title.toLowerCase()}.`);
  }

  // Add slide titles as key points (if enough slides)
  const contentSlides = slides.filter(s => s.type === 'content');
  const bulletSlide = contentSlides.find(s => s.bullets && s.bullets.length >= 3);
  if (contentSlides.length >= 2) {
    const points = contentSlides
      .filter(s => s !== bulletSlide) // avoid repeating bullet slide title
      .slice(0, 4)
      .map(s => `✅ ${s.title}`)
      .join('\n');
    if (points) parts.push(points);
  }

  // Add bullet takeaways from first bullet-rich slide
  if (bulletSlide) {
    const bullets = bulletSlide.bullets
      .slice(0, 4)
      .map(b => `→ ${truncate(b, 70)}`)
      .join('\n');
    parts.push(bulletSlide.title ? `${bulletSlide.title}:\n${bullets}` : bullets);
  }

  return parts.join('\n\n');
};

export const generateCaption = (article, slides = []) => {
  if (!article) return { hook: '', body: '', cta: '', hashtags: '' };

  const title = article.title || 'Untitled';
  const url = article.url || null;

  // Use URL-aware CTA 50% of the time when URL is available
  let cta;
  if (url && Math.random() < 0.5) {
    cta = pick(CTA_TEMPLATES_WITH_URL)(url);
  } else {
    cta = pick(CTA_TEMPLATES);
  }

  return {
    hook: pick(HOOK_TEMPLATES)(truncate(title, 80)),
    body: buildBody(article, slides),
    cta,
    hashtags: buildHashtags(article),
  };
};
