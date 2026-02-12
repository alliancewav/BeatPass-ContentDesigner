// ─── Tweet & Thread Generator ───
// Template-based tweet generation from article data.
// t.co wraps all URLs to 23 chars — budget accordingly.

import CONFIG from '../config';

const T_CO_LEN = 23; // Twitter wraps all URLs to this length
const MAX_CHARS = 280;
const URL_BASE = `https://${CONFIG.brand.domain}`;

const buildUrl = (slug) => slug ? `${URL_BASE}/${slug}/` : `${URL_BASE}/`;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const truncate = (text, limit) => {
  if (!text || text.length <= limit) return text || '';
  const cut = text.substring(0, limit).replace(/\s+\S*$/, '').trim();
  return (cut || text.substring(0, limit)) + '…';
};

// ── Single Tweet Templates ──
// Each receives (title, url) where url is already accounted for as 23 chars
const SINGLE_TEMPLATES = [
  (title, url) => `🔥 ${title}\n\n${url}`,
  (title, url) => `New on the blog: ${title}\n\nRead more 👇\n${url}`,
  (title, url) => `${title}\n\nFull breakdown on the blog:\n${url}`,
  (title, url) => `📌 ${title}\n\n${url}`,
  (title, url) => `Just published: ${title}\n\nCheck it out → ${url}`,
];

// ── Thread Hook Templates (no URL) ──
const THREAD_HOOKS = [
  (title) => `🧵 ${title}\n\nA thread 👇`,
  (title) => `Let's talk about ${title.toLowerCase()}.\n\nThread 🧵👇`,
  (title) => `${title}\n\nHere's everything you need to know 🧵`,
  (title) => `Most people get ${title.toLowerCase()} wrong.\n\nLet me break it down 🧵`,
];

// ── Thread CTA Templates (with URL) ──
const THREAD_CTAS = [
  (url) => `📖 Want the full deep-dive? Read the complete article:\n\n${url}\n\nIf this thread helped, give it a RT 🔁`,
  (url) => `That's a wrap! 🎬\n\nFull article with more details:\n${url}\n\nFollow @beatpass for more music production tips`,
  (url) => `💡 Found this useful? Share it with someone who needs it.\n\nFull article → ${url}`,
];

// Fit text to tweet limit accounting for t.co URL compression
const fitToLimit = (text, hasUrl = false) => {
  const budget = hasUrl ? MAX_CHARS - T_CO_LEN - 1 : MAX_CHARS; // -1 for the space/newline before URL
  if (text.length <= budget) return text;
  return truncate(text, budget);
};

// ── Public: Generate single tweet variations ──
export const generateTweet = (article) => {
  if (!article) return [''];

  const title = article.title || 'Untitled';
  const url = buildUrl(article.slug);

  // Generate 3 variations
  const used = new Set();
  const results = [];

  while (results.length < 3 && used.size < SINGLE_TEMPLATES.length) {
    const idx = Math.floor(Math.random() * SINGLE_TEMPLATES.length);
    if (used.has(idx)) continue;
    used.add(idx);

    const tpl = SINGLE_TEMPLATES[idx];
    // Truncate title to fit within 280 chars accounting for template overhead + URL
    const maxTitleLen = MAX_CHARS - T_CO_LEN - 30; // rough overhead for template text
    const tweet = tpl(truncate(title, maxTitleLen), url);

    // Final safety check
    const finalLen = tweet.replace(url, 'x'.repeat(T_CO_LEN)).length;
    if (finalLen <= MAX_CHARS) {
      results.push(tweet);
    } else {
      // Re-truncate
      results.push(fitToLimit(tweet.replace(url, '').trim(), true) + '\n' + url);
    }
  }

  return results.length > 0 ? results : [`${truncate(title, MAX_CHARS - T_CO_LEN - 2)}\n${url}`];
};

// ── Public: Generate tweet thread/bomb ──
export const generateThread = (article, slides = []) => {
  if (!article) return [''];

  const title = article.title || 'Untitled';
  const url = buildUrl(article.slug);
  const excerpt = article.excerpt || '';
  const contentSlides = slides.filter(s => s.type === 'content');
  const thread = [];

  // 1. Hook tweet (no URL)
  const hook = pick(THREAD_HOOKS)(truncate(title, 200));
  thread.push(fitToLimit(hook));

  // 2. Excerpt tweet (if available)
  if (excerpt.length > 20) {
    thread.push(fitToLimit(truncate(excerpt, MAX_CHARS - 5)));
  }

  // 3. Key points from slides (1 tweet per slide)
  for (const slide of contentSlides.slice(0, 5)) {
    const slideTitle = slide.title || '';
    const slideContent = slide.content || '';
    let text = '';

    if (slideContent.length > 20) {
      text = `${slideTitle}\n\n${truncate(slideContent, MAX_CHARS - slideTitle.length - 10)}`;
    } else if (slide.bullets && slide.bullets.length > 0) {
      // Build bullets incrementally to avoid cutting mid-bullet (CodeRabbit #7)
      const headerLen = slideTitle.length + 2; // +2 for \n\n
      let bulletBody = '';
      for (const b of slide.bullets) {
        const candidate = bulletBody ? `${bulletBody}\n• ${b}` : `• ${b}`;
        if (headerLen + candidate.length > MAX_CHARS - 5) break;
        bulletBody = candidate;
      }
      text = bulletBody ? `${slideTitle}\n\n${bulletBody}` : slideTitle;
    } else {
      text = slideTitle;
    }

    if (text.length > 10) {
      thread.push(fitToLimit(text));
    }
  }

  // 4. CTA tweet with URL
  const cta = pick(THREAD_CTAS)(url);
  // Verify it fits
  const ctaLen = cta.replace(url, 'x'.repeat(T_CO_LEN)).length;
  if (ctaLen <= MAX_CHARS) {
    thread.push(cta);
  } else {
    thread.push(`Full article → ${url}`);
  }

  return thread;
};
