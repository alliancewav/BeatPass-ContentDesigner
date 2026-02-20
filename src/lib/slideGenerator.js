// ─── Slide Generation Engine ───
// Converts a parsed Ghost article into an array of slide objects.
// "Mini landing page" style: clean text slides + max 2 dedicated image slides.

import CONFIG from '../config';
import { LIMITS, getLimitsForDensity, DENSITY_PRESETS } from './layoutEngine';

const { maxImageSlides: MAX_IMG_SLIDES } = CONFIG.slides;

// Default content limits (balanced density) — used as fallback
const CHAR_LIMIT        = LIMITS.contentCharLimit;
const BULLET_INTRO_LIMIT = LIMITS.bulletIntroCharLimit;
const BULLET_LIMIT      = LIMITS.bulletCharLimit;
const MAX_BULLETS       = LIMITS.maxBulletsNoIntro;
const MAX_BULLETS_INTRO = LIMITS.maxBulletsWithIntro;
const MAX_TITLE_LEN     = LIMITS.maxTitleLen;

// ── Image Helpers ──

const normaliseImgUrl = (url) => {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.pathname = u.pathname.replace(/\/size\/w\d+\//, '/');
    u.search = '';
    return u.href;
  } catch { return url; }
};

const extractImgData = (node) => {
  if (!node) return null;
  if (node.tagName === 'IMG' && node.src) return { src: node.src, caption: node.alt || null };
  if (node.tagName === 'FIGURE' || (node.classList && (
    node.classList.contains('kg-image-card') ||
    node.classList.contains('kg-gallery-card') ||
    node.classList.contains('kg-card')
  ))) {
    // For galleries: pick widest image for best slide background quality
    const isGallery = node.classList && node.classList.contains('kg-gallery-card');
    let img = null;
    if (isGallery) {
      const imgs = Array.from(node.querySelectorAll('img'));
      img = imgs.reduce((best, cur) => {
        const bw = parseInt(best?.getAttribute('width') || '0', 10);
        const cw = parseInt(cur.getAttribute('width') || '0', 10);
        return cw > bw ? cur : best;
      }, imgs[0] || null);
    } else {
      img = node.querySelector('img');
    }
    if (img && img.src) {
      const figcap = node.querySelector('figcaption');
      const caption = figcap ? figcap.innerText.replace(/\s+/g, ' ').trim() : (img.alt || null);
      return { src: img.src, caption: caption && caption.length > 3 ? caption : null };
    }
  }
  return null;
};

// Keep backward-compatible alias
const extractImgSrc = (node) => extractImgData(node)?.src || null;

// ── YouTube / Video Helpers ──

// Extract YouTube video ID from various URL formats
const extractYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

// Get YouTube thumbnail URL from video ID
const youTubeThumbnail = (videoId) =>
  `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

// Normalise any YouTube URL to a standard watch URL
export const normaliseYouTubeUrl = (url) => {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : url;
};

// Find embedded YouTube videos in article HTML
const findYouTubeEmbeds = (doc) => {
  const videos = [];
  doc.querySelectorAll('iframe').forEach((iframe) => {
    const src = iframe.src || iframe.getAttribute('src') || '';
    const id = extractYouTubeId(src);
    if (id) {
      videos.push({
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: youTubeThumbnail(id),
      });
    }
  });
  return videos;
};

// ── Text Condensation ──

const condenseSentences = (text, limit = CHAR_LIMIT) => {
  if (!text || text.length <= limit) return text || '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let result = '';
  for (const s of sentences) {
    if ((result + s).length > limit) break;
    result += s;
  }
  // If we got at least one complete sentence, return it without ellipsis
  if (result.trim()) return result.trim();
  // Otherwise truncate at the last word boundary
  const truncated = text.substring(0, limit).replace(/\s+\S*$/, '').trim();
  return truncated || text.substring(0, limit);
};

const truncateBullet = (text, limit = BULLET_LIMIT) => {
  if (text.length <= limit) return text;
  // Try to end at a sentence boundary within limit
  const chunk = text.substring(0, limit);
  const sentenceEnd = chunk.match(/^(.*[.!?])\s/s);
  if (sentenceEnd && sentenceEnd[1].length > 20) return sentenceEnd[1].trim();
  // Fall back to word boundary — no ellipsis (preserves context for carousel slides)
  const wordBound = chunk.replace(/\s+\S*$/, '').trim();
  return wordBound || chunk;
};

const extractBullets = (listNodes) => {
  const bullets = [];
  for (const list of listNodes) {
    const items = list.querySelectorAll('li');
    for (const li of items) {
      for (const br of li.querySelectorAll('br')) br.replaceWith(' ');
      let t = li.innerText.replace(/\s+/g, ' ').trim();
      if (t.length > 10) {
        if (t.length > BULLET_LIMIT) t = truncateBullet(t, BULLET_LIMIT);
        bullets.push(t);
      }
    }
  }
  return bullets;
};

// ── Section Parser ──

// Detect Ghost-style bold lead paragraphs: <p><strong>Title</strong><br>Body text...</p>
// Returns { heading, body } or null
const splitBoldLeadParagraph = (pNode) => {
  const children = Array.from(pNode.childNodes);
  if (children.length < 3) return null;
  // First child must be <strong> or <b>
  const first = children[0];
  if (!first || (first.nodeName !== 'STRONG' && first.nodeName !== 'B')) return null;
  // Second child must be <br>
  const second = children[1];
  if (!second || second.nodeName !== 'BR') return null;
  const headingText = first.textContent.replace(/\s+/g, ' ').trim();
  if (!headingText || headingText.length < 2 || headingText.length > 120) return null;
  // Collect remaining text after <br>
  const bodyText = children.slice(2).map(n => n.textContent || '').join('').replace(/\s+/g, ' ').trim();
  if (!bodyText || bodyText.length < 10) return null;
  return { heading: headingText, body: bodyText };
};

const parseSections = (doc, featureImage) => {
  const featureNorm = normaliseImgUrl(featureImage);
  const usedImages = new Set();
  if (featureNorm) usedImages.add(featureNorm);

  const useImage = (src) => {
    if (!src) return null;
    const norm = normaliseImgUrl(src);
    if (usedImages.has(norm)) return null;
    usedImages.add(norm);
    return src;
  };

  const sections = [];
  // Fall back to H1 headings if no H2s found (some articles use H1 for sections)
  const h2s = doc.querySelectorAll('h2');
  const useH1 = h2s.length === 0;
  const headings = useH1 ? Array.from(doc.querySelectorAll('h1')).filter(h => h.tagName === 'H1') : Array.from(h2s);
  const SECTION_TAG = useH1 ? 'H1' : 'H2';

  for (const h2 of headings) {
    let rawTitle = h2.innerText.replace(/\s+/g, ' ').trim();
    // Truncate very long titles at word boundary
    if (rawTitle.length > MAX_TITLE_LEN) {
      rawTitle = rawTitle.substring(0, MAX_TITLE_LEN).replace(/\s+\S*$/, '').trim() || rawTitle.substring(0, MAX_TITLE_LEN);
    }
    const section = {
      title: rawTitle,
      paragraphs: [],
      bullets: [],
      image: null,
      imageCaption: null,
      subHeadings: [],        // H3 titles within this section
      h3Paragraphs: new Map(), // H3 title → [following paragraphs] (for FAQ Q&A)
      sectionIntro: null,      // First paragraph BEFORE any H3 (true intro, not an H3 answer)
      callouts: [],            // Ghost callout cards & blockquotes: [{emoji, text, isQuote}]
      tableData: null,         // Ghost table card: {headers, rows}
      codeBlocks: [],          // Ghost code blocks: [string]
      h3CodeBlocks: new Map(), // code blocks keyed by H3 heading
    };

    // Walk siblings until next section heading, capturing H3 context
    let node = h2.nextElementSibling;
    const listNodes = [];
    let currentH3 = null; // Track which H3 we're under
    let lastParaBeforeFirstList = null; // Track the paragraph that introduces the first bullet list
    let hitFirstList = false;
    let hitFirstH3 = false; // Track whether we've seen an H3 yet

    while (node) {
      if (node.tagName === SECTION_TAG) break;

      if (node.tagName === 'H3' || node.tagName === 'H4') {
        const h3Text = node.innerText.replace(/\s+/g, ' ').trim();
        if (h3Text.length > 3) {
          section.subHeadings.push(h3Text);
          currentH3 = h3Text;
          hitFirstH3 = true;
          section.h3Paragraphs.set(currentH3, []);
        }
        node = node.nextElementSibling;
        continue;
      }

      // Ghost toggle card: <div class="kg-toggle-card"> or <details>
      const isToggleCard = node.classList && node.classList.contains('kg-toggle-card');
      if (isToggleCard || node.tagName === 'DETAILS') {
        const headingEl = node.querySelector('.kg-toggle-heading-text, .kg-toggle-heading h3, summary h3, summary');
        const contentEl = node.querySelector('.kg-toggle-content');
        if (headingEl) {
          const rawH = headingEl.innerText.replace(/\s+/g, ' ').trim().replace(/^[▼▲►▸▾]\s*/, '');
          if (rawH.length > 3) {
            section.subHeadings.push(rawH);
            currentH3 = rawH;
            hitFirstH3 = true;
            section.h3Paragraphs.set(currentH3, []);
          }
        }
        if (contentEl) {
          for (const p of contentEl.querySelectorAll('p, li')) {
            const t = p.innerText.replace(/\s+/g, ' ').trim();
            if (t.length > 15) {
              section.paragraphs.push(t);
              if (!hitFirstList) lastParaBeforeFirstList = t;
              if (currentH3 && section.h3Paragraphs.has(currentH3)) {
                section.h3Paragraphs.get(currentH3).push(t);
              }
            }
          }
        }
        node = node.nextElementSibling;
        continue;
      }

      // Ghost bookmark card: <figure class="kg-bookmark-card">
      if (node.classList && (node.classList.contains('kg-bookmark-card') || node.classList.contains('kg-embed-card'))) {
        const titleEl = node.querySelector('.kg-bookmark-title');
        const descEl = node.querySelector('.kg-bookmark-description');
        const title = titleEl ? titleEl.innerText.replace(/\s+/g, ' ').trim() : '';
        const desc = descEl ? descEl.innerText.replace(/\s+/g, ' ').trim() : '';
        const combined = title && desc ? `${title}: ${desc}` : title || desc;
        if (combined.length > 15) section.paragraphs.push(combined);
        node = node.nextElementSibling;
        continue;
      }

      // Ghost callout card: <div class="kg-callout-card">
      if (node.classList && node.classList.contains('kg-callout-card')) {
        const emojiEl = node.querySelector('.kg-callout-emoji');
        const textEl = node.querySelector('.kg-callout-text');
        const emoji = emojiEl ? emojiEl.innerText.trim() : '';
        const text = textEl
          ? textEl.innerText.replace(/\s+/g, ' ').trim()
          : node.innerText.replace(/\s+/g, ' ').trim();
        if (text.length > 10) section.callouts.push({ emoji, text, isQuote: false });
        node = node.nextElementSibling;
        continue;
      }

      // Blockquote (pull quote)
      if (node.tagName === 'BLOCKQUOTE') {
        let text = node.innerText.replace(/\s+/g, ' ').trim();
        // Strip leading/trailing typographic and ASCII quotation marks
        text = text.replace(/^[\u201C\u201E\u2018\u201A"']+|[\u201D\u2019"']+$/g, '').trim();
        if (text.length > 10) section.callouts.push({ emoji: '', text, isQuote: true });
        node = node.nextElementSibling;
        continue;
      }

      // Ghost code card: <figure class="kg-code-card"><pre><code>...</code></pre></figure>
      const isKgCodeCard = node.tagName === 'FIGURE' && node.classList && node.classList.contains('kg-code-card');
      if (isKgCodeCard) {
        const preEl = node.querySelector('pre');
        const code = preEl ? (preEl.textContent ?? preEl.innerText ?? '').replace(/\r\n/g, '\n').trim() : '';
        if (code.length > 5) {
          section.codeBlocks.push(code);
          if (currentH3) {
            if (!section.h3CodeBlocks.has(currentH3)) section.h3CodeBlocks.set(currentH3, []);
            section.h3CodeBlocks.get(currentH3).push(code);
          }
        }
        node = node.nextElementSibling;
        continue;
      }

      // Code block: bare <pre><code>
      if (node.tagName === 'PRE') {
        const code = (node.textContent ?? node.innerText ?? '').replace(/\r\n/g, '\n').trim();
        if (code.length > 5) {
          section.codeBlocks.push(code);
          if (currentH3) {
            if (!section.h3CodeBlocks.has(currentH3)) section.h3CodeBlocks.set(currentH3, []);
            section.h3CodeBlocks.get(currentH3).push(code);
          }
        }
        node = node.nextElementSibling;
        continue;
      }

      // Ghost table card: <figure class="kg-table-card"> or bare <table>
      const isTableCard = node.tagName === 'FIGURE' && node.classList && node.classList.contains('kg-table-card');
      if (isTableCard || node.tagName === 'TABLE') {
        if (!section.tableData) {
          const tableEl = node.tagName === 'TABLE' ? node : node.querySelector('table');
          if (tableEl) {
            const headers = [];
            const rows = [];
            tableEl.querySelectorAll('thead th, thead td').forEach(th =>
              headers.push(th.innerText.replace(/\s+/g, ' ').trim())
            );
            tableEl.querySelectorAll('tbody tr').forEach(tr => {
              const row = [];
              tr.querySelectorAll('td, th').forEach(cell =>
                row.push(cell.innerText.replace(/\s+/g, ' ').trim())
              );
              if (row.some(c => c.length > 0)) rows.push(row);
            });
            if (rows.length > 0) section.tableData = { headers, rows };
          }
        }
        node = node.nextElementSibling;
        continue;
      }

      // Ghost-style bold lead paragraph: <p><strong>Title</strong><br>Body...</p>
      if (node.tagName === 'P') {
        const boldLead = splitBoldLeadParagraph(node);
        if (boldLead) {
          section.subHeadings.push(boldLead.heading);
          currentH3 = boldLead.heading;
          hitFirstH3 = true;
          section.h3Paragraphs.set(currentH3, []);
          if (boldLead.body.length > 15) {
            section.paragraphs.push(boldLead.body);
            if (!hitFirstList) lastParaBeforeFirstList = boldLead.body;
            section.h3Paragraphs.get(currentH3).push(boldLead.body);
          }
          node = node.nextElementSibling;
          continue;
        }
      }

      // Capture first image in section only
      if (!section.image) {
        const imgData = extractImgData(node);
        if (imgData?.src) {
          section.image = useImage(imgData.src);
          if (section.image) section.imageCaption = imgData.caption || null;
        }
      }

      if (node.tagName === 'P') {
        for (const br of node.querySelectorAll('br')) br.replaceWith(' ');
        const text = node.innerText.replace(/\s+/g, ' ').trim();
        if (text.length > 15) {
          section.paragraphs.push(text);
          if (!hitFirstList) lastParaBeforeFirstList = text;
          // Capture first paragraph before any H3 as true section intro
          if (!hitFirstH3 && !section.sectionIntro) section.sectionIntro = text;
          // Also track which H3 this paragraph belongs to
          if (currentH3 && section.h3Paragraphs.has(currentH3)) {
            section.h3Paragraphs.get(currentH3).push(text);
          }
        }
      }

      if (node.tagName === 'UL' || node.tagName === 'OL') {
        if (!hitFirstList) hitFirstList = true;
        listNodes.push(node);
      }

      node = node.nextElementSibling;
    }

    if (listNodes.length > 0) {
      section.bullets = extractBullets(listNodes);
    }

    section.bulletIntro = lastParaBeforeFirstList;

    if (section.paragraphs.length > 0 || section.bullets.length > 0) {
      sections.push(section);
    }
  }

  return { sections, usedImages };
};

// ── Beat / Video Article Detection & Slide Generation ──
// Triggers ONLY when all 3 conditions are met:
//   1. Article has internal tag #video (slug: hash-video)
//   2. Article has internal tag #video-preview (slug: hash-video-preview)
//   3. Article HTML contains an open.beatpass.ca/track/* URL

const isBeatArticle = (article) => {
  const tags = article.tags || [];
  const hasVideo = tags.includes('hash-video');
  const hasPreview = tags.includes('hash-video-preview');
  if (!hasVideo || !hasPreview) return false;
  if (!article.html) return false;
  return /open\.beatpass\.ca\/track\//.test(article.html);
};

const parseBeatMeta = (html) => {
  if (!html) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // YouTube embed
  const firstEmbed = doc.querySelector('figure.kg-embed-card iframe');
  if (!firstEmbed) return null;
  const ytId = extractYouTubeId(firstEmbed.src || firstEmbed.getAttribute('src') || '');
  if (!ytId) return null;

  // Description paragraph
  const paragraphs = Array.from(doc.querySelectorAll('p'))
    .map(p => p.innerText.replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 10);
  const desc = paragraphs[0] || '';

  // BPM
  const bpmMatch = desc.match(/(\d{2,3})\s*BPM/i);
  const bpm = bpmMatch ? bpmMatch[1] : null;

  // Duration
  const durMatch = desc.match(/\((\d+:\d{2})\)/);
  const duration = durMatch ? durMatch[1] : null;

  // Producer (bold text after H2)
  let producer = null;
  const strongEl = doc.querySelector('h2 ~ p strong');
  if (strongEl) producer = strongEl.innerText.trim();

  // Genres
  let genres = [];
  const genreMatch = desc.match(/(?:a|for a)\s+(.+?)\s+beat/i);
  if (genreMatch) {
    genres = genreMatch[1]
      .split(/\s*[\/&,]\s*/)
      .map(g => g.trim())
      .filter(g => g.length > 0 && g.length < 30);
  }

  // Beat title from H2
  const h2 = doc.querySelector('h2');
  const beatTitle = h2 ? h2.innerText.trim() : null;

  // Streaming link
  const streamLink = doc.querySelector('a[href*="open.beatpass.ca/track"]');
  const streamUrl = streamLink ? streamLink.href : null;

  return {
    ytId,
    ytUrl: `https://www.youtube.com/watch?v=${ytId}`,
    beatTitle,
    producer,
    genres,
    bpm,
    duration,
    streamUrl,
  };
};

const generateBeatSlides = (article, meta) => {
  // Exactly 3 slides: Cover → Player → CTA

  // 1. Cover — engaging for Instagram (no blog domain)
  const genreLabel = meta.genres.length > 0
    ? meta.genres.slice(0, 2).join(' · ')
    : 'Beat';
  const slides = [{
    id: `slide-cover-${Date.now()}`,
    type: 'cover',
    title: article.title,
    subtitle: genreLabel,
    readingTime: meta.bpm ? `${meta.bpm} BPM` : '',
    featureImage: article.featureImage,
    beatCover: {
      producer: meta.producer || '',
      bpm: meta.bpm || null,
    },
  }];

  // 2. Player-layout video slide (single video slide)
  slides.push({
    id: `slide-content-${Date.now()}-1`,
    type: 'content',
    title: meta.beatTitle || 'Now Playing',
    content: '',
    bullets: null,
    imageSlide: false,
    image: null,
    parallaxGroup: null,
    parallaxPosition: null,
    videoUrl: meta.ytUrl,
    number: 1,
    playerLayout: {
      producer: meta.producer || 'Unknown',
      genres: meta.genres || [],
      bpm: meta.bpm || null,
      duration: meta.duration || null,
      streamUrl: meta.streamUrl || null,
    },
  });

  // 3. CTA
  slides.push({
    id: `slide-cta-${Date.now()}`,
    type: 'cta',
    title: 'Stream Now',
    subtitle: CONFIG.brand.domain,
    featureImage: article.featureImage,
  });

  return slides;
};

// ── Main ──

export const generateSlides = (article, { density = 'balanced' } = {}) => {
  // Check if this is a beat/video article (requires #video + #video-preview tags + track URL)
  if (isBeatArticle(article)) {
    const beatMeta = parseBeatMeta(article.html);
    if (beatMeta) return generateBeatSlides(article, beatMeta);
  }

  // Resolve density-aware limits and slide count targets
  const densityLimits = getLimitsForDensity(density);
  const preset = DENSITY_PRESETS[density] || DENSITY_PRESETS.balanced;
  const maxSlides = preset.maxSlides;

  const slides = [];

  // 1. Cover slide
  slides.push({
    id: `slide-cover-${Date.now()}`,
    type: 'cover',
    title: article.title,
    subtitle: article.primaryTag || CONFIG.brand.domain,
    readingTime: `${article.readingTime} min read`,
    featureImage: article.featureImage,
    publishedAt: article.publishedAt || null,
    primaryAuthor: article.primaryAuthor || null,
  });

  // 2. Content slides
  const contentSlides = extractContentSlides(article.html, article.featureImage, densityLimits, maxSlides, density);
  contentSlides.forEach((cs, idx) => {
    if (slides.length >= maxSlides - 1) return;
    slides.push({
      id: `slide-content-${Date.now()}-${idx}`,
      type: 'content',
      title: cs.title,
      content: cs.content || '',
      bullets: cs.bullets || null,
      imageSlide: cs.imageSlide || false,
      image: cs.image || null,
      parallaxGroup: null,
      parallaxPosition: null,
      videoUrl: cs.videoUrl || null,
      number: idx + 1,
      isContinuation: cs.isContinuation || false,
      subtype: cs.subtype || null,
      tableData: cs.tableData || null,
      calloutEmoji: cs.calloutEmoji || '',
      calloutText: cs.calloutText || '',
      calloutIsQuote: cs.calloutIsQuote || false,
      imageCaption: cs.imageCaption || null,
      subHeadingLabel: cs.subHeadingLabel || null,
      codeSubtitle: cs.codeSubtitle || '',
      codeCaption: cs.codeCaption || '',
    });
  });

  // 3. Fallback: generate from excerpt
  if (contentSlides.length === 0 && article.excerpt) {
    slides.push({
      id: `slide-excerpt-${Date.now()}`,
      type: 'content',
      title: 'Key Takeaway',
      content: condenseSentences(article.excerpt, densityLimits.contentCharLimit),
      bullets: null,
      imageSlide: false,
      image: null,
      parallaxGroup: null,
      parallaxPosition: null,
      videoUrl: null,
      number: 1,
    });
  }

  // 4. CTA slide
  slides.push({
    id: `slide-cta-${Date.now()}`,
    type: 'cta',
    title: 'Read the Full Article',
    subtitle: CONFIG.brand.domain,
    ctaHeading: 'Read Full\nArticle',
    ctaLabel: 'Link in Bio',
    featureImage: article.featureImage,
  });

  // Re-number content slides
  let num = 0;
  slides.forEach((s) => { if (s.type === 'content') { num++; s.number = num; } });

  return slides;
};

// ── Section → Slide(s) Expander ──
// Converts a single parsed section into one or more slide objects.
// The FIRST slide of each section is always the most content-dense
// (overview with bullets or packed paragraphs) so that even when
// the allocation only allows 1 slide per section, coverage is maximised.

function expandSection(sec, limits) {
  const L = limits || LIMITS;
  const charLimit = L.contentCharLimit;
  const bulletIntroLimit = L.bulletIntroCharLimit;
  const bulletLimit = L.bulletCharLimit;
  const maxBullets = L.maxBulletsNoIntro;
  const maxBulletsIntro = L.maxBulletsWithIntro;
  const maxTitleLen = L.maxTitleLen;

  const slides = [];
  const title = sec.title;
  const titleLower = title.toLowerCase().trim();

  // Skip boilerplate-only sections (link lists, bios, disclaimers, references)
  const SKIP_PATTERNS = [
    'next read', 'related', 'further reading', 'about the author',
    'author bio', 'disclaimer', 'references', 'sources', 'footnotes', 'bibliography', 'see also',
    'read next', 'you might also like', 'more articles', 'more posts', 'more reads',
    'keep reading', 'also read', 'editor\'s note', 'correction', 'disclosure',
    'affiliate', 'sponsored', 'subscribe', 'newsletter', 'share this', 'follow us',
  ];
  const isBoilerplate = SKIP_PATTERNS.some(p => titleLower.includes(p)) && sec.paragraphs.length === 0;
  if (isBoilerplate) return slides;

  const isFaqPattern = ['faqs', 'faq', 'common misconceptions', 'myths', 'common questions'].includes(titleLower)
    || (titleLower.includes('misconception') || titleLower.includes('myth') || titleLower.includes('faq'));
  const isFaqSection = isFaqPattern && sec.subHeadings.length >= 2;
  let mainContentDone = false;

  // ── Strategy A: FAQ section ──
  // First slide: overview with FAQ questions as bullet points (max density).
  // Continuations: individual Q&A pairs for deep reading.
  if (isFaqSection) {
    const questions = [];
    for (const [q] of sec.h3Paragraphs) {
      if (q.length > 10) {
        const short = q.length > bulletLimit
          ? q.substring(0, bulletLimit).replace(/\s+\S*$/, '').trim()
          : q;
        questions.push(short.replace(/\?*$/, '?'));
      }
    }
    if (questions.length > 0) {
      // Use only true pre-H3 intro (not an answer paragraph)
      const introContent = sec.sectionIntro
        ? condenseSentences(sec.sectionIntro, bulletIntroLimit) : '';
      slides.push({
        title,
        content: introContent,
        bullets: questions.slice(0, maxBullets),
      });
    }
    // Continuations: one slide per Q&A pair
    for (const [q, paras] of sec.h3Paragraphs) {
      const answer = paras.join(' ');
      if (!answer || answer.length < 20) continue;
      let slideTitle = q.length > maxTitleLen
        ? q.substring(0, maxTitleLen).replace(/\s+\S*$/, '').trim() + '?'
        : q.replace(/\?*$/, '?');
      slides.push({
        title: slideTitle,
        content: condenseSentences(answer, charLimit),
        bullets: null,
      });
    }
    mainContentDone = slides.length > 0;
  }

  // ── Strategy B: Section with bullets ──
  // Bullet counts derived from pixel-budget math in layoutEngine:
  //   With intro text: maxBulletsIntro — title + intro + bullets must fit square canvas
  //   Without intro:   maxBullets — title + bullets only
  if (!mainContentDone && sec.bullets.length >= 2) {
    const allBullets = sec.bullets;
    const introContent = sec.bulletIntro
      ? condenseSentences(sec.bulletIntro, bulletIntroLimit)
      : '';

    const hasIntro = introContent.length > 0;
    const firstCount = hasIntro
      ? Math.min(maxBulletsIntro, allBullets.length)
      : Math.min(maxBullets, allBullets.length);

    const firstChunk = allBullets.slice(0, firstCount);
    slides.push({
      title,
      content: introContent,
      bullets: firstChunk,
    });

    // Continuation slides: only create if there are enough bullets to fill the slide
    const MIN_CONTINUATION_BULLETS = Math.max(2, Math.floor(maxBullets * 0.6));
    let remaining = allBullets.slice(firstCount);
    // Pixel-budget-safe cap for the first slide (intro-aware)
    const firstSlideMax = hasIntro ? maxBulletsIntro : maxBullets;
    // If the tail is too small, absorb into first slide up to its safe cap
    if (remaining.length > 0 && remaining.length < MIN_CONTINUATION_BULLETS) {
      const extra = Math.min(remaining.length, firstSlideMax - firstChunk.length);
      if (extra > 0) {
        slides[0].bullets = firstChunk.concat(remaining.slice(0, extra));
        remaining = remaining.slice(extra);
      }
    }
    for (let i = 0; i < remaining.length; i += maxBullets) {
      const chunk = remaining.slice(i, i + maxBullets);
      if (chunk.length >= MIN_CONTINUATION_BULLETS) {
        slides.push({ title, content: '', bullets: chunk, isContinuation: true });
      } else if (slides.length > 0) {
        // Absorb tiny tail into previous slide, respecting pixel-budget cap
        const prev = slides[slides.length - 1];
        const prevMax = (prev.content && prev.content.length > 0) ? maxBulletsIntro : maxBullets;
        const room = prevMax - (prev.bullets || []).length;
        if (room > 0) {
          prev.bullets = (prev.bullets || []).concat(chunk.slice(0, room));
        }
        // Drop any bullets that don't fit — they'd cause overflow
      }
    }
    mainContentDone = slides.length > 0;
  }

  // ── Strategy C: Section with H3 subheadings (non-FAQ) ──
  // Preserve H3 titles by prepending them to their paragraph blocks.
  // This keeps hierarchical context that would otherwise be lost.
  if (!mainContentDone && sec.subHeadings.length >= 2 && sec.h3Paragraphs.size >= 2) {
    // Build enriched text: "H3 Title: paragraph text" for each sub-section
    const enrichedParts = [];
    // Include any pre-H3 intro paragraph first
    if (sec.sectionIntro) enrichedParts.push(sec.sectionIntro);
    for (const [h3Title, paras] of sec.h3Paragraphs) {
      const body = paras.join(' ');
      if (body.length < 20) continue;
      enrichedParts.push(`${h3Title}: ${body}`);
    }
    if (enrichedParts.length > 0) {
      const fullText = enrichedParts.join(' ');
      // Collapse into a single slide when all enriched H3 content fits within
      // the body pixel budget, OR when every H3 sub-section is individually
      // too thin for its own slide (prevents sparse 1-sentence continuations).
      const subHeadingBudget = 52;
      const bodyLimit = Math.max(charLimit - subHeadingBudget, Math.floor(charLimit * 0.7));
      const MIN_STANDALONE = Math.floor(charLimit * 0.35);
      const allH3Thin = [...sec.h3Paragraphs.values()].every(p => p.join(' ').length < MIN_STANDALONE);

      if (fullText.length <= bodyLimit) {
        slides.push({ title, content: fullText, bullets: null });
      } else if (fullText.length <= charLimit || allH3Thin) {
        // Either fits within charLimit, or every H3 is too thin for its own
        // slide — condense the whole section into one well-filled slide.
        slides.push({ title, content: condenseSentences(fullText, bodyLimit), bullets: null });
      } else {
        // Per-H3 slides with greedy packing: accumulate thin H3 sub-sections
        // into a single slide until the content fills the pixel budget, so no
        // slide ends up with just one short sentence.

        // Collect all eligible H3 items first
        const h3Items = [];
        for (const [h3Title, paras] of sec.h3Paragraphs) {
          const body = paras.join(' ');
          const h3HasCode = !!(sec.h3CodeBlocks && sec.h3CodeBlocks.get(h3Title)?.length);
          if (body.length < (h3HasCode ? 15 : 40)) continue;
          const h3Codes = sec.h3CodeBlocks && sec.h3CodeBlocks.get(h3Title);
          h3Items.push({ h3Title, body, h3Codes: h3Codes || null });
        }

        let h3IsFirst = true;
        let accum = ''; // accumulated body text for the current packed slide
        let accumLabel = ''; // combined H3 label for the packed slide

        const flushAccum = () => {
          if (!accum) return;
          slides.push({
            title, content: condenseSentences(accum, bodyLimit), bullets: null,
            subHeadingLabel: accumLabel, isContinuation: !h3IsFirst,
          });
          h3IsFirst = false;
          accum = '';
          accumLabel = '';
        };

        for (let hi = 0; hi < h3Items.length; hi++) {
          const { h3Title, body, h3Codes } = h3Items[hi];

          // Code block H3 → always its own slide (special layout)
          if (h3Codes && h3Codes.length > 0) {
            flushAccum();
            const lines = h3Codes[0].split('\n').filter(l => l.trim().length > 0).slice(0, 6);
            const codeText = lines.join('\n').substring(0, 400);
            if (codeText.length > 5) {
              const codeCaption = condenseSentences(body, 130);
              slides.push({ title: h3Title, content: codeText, bullets: null, subtype: 'code', codeCaption, isContinuation: !h3IsFirst });
              h3IsFirst = false;
              continue;
            }
          }

          // Prepend sectionIntro to the very first H3 body
          const fullBody = (h3IsFirst && !accum && sec.sectionIntro) ? `${sec.sectionIntro} ${body}` : body;
          const enriched = `${h3Title}: ${fullBody}`;

          // If this H3 is thin AND fits with the accumulator, pack them together
          if (fullBody.length < MIN_STANDALONE && (accum + ' ' + enriched).trim().length <= bodyLimit) {
            accum = (accum ? accum + ' ' + enriched : enriched).trim();
            accumLabel = accumLabel ? accumLabel : h3Title;
            continue;
          }

          // If there's accumulated content, check if this H3 also fits
          if (accum && (accum + ' ' + enriched).trim().length <= bodyLimit) {
            accum = (accum + ' ' + enriched).trim();
            continue;
          }

          // Flush any accumulated content first
          flushAccum();

          // If this H3 is thin on its own and there's a next H3, start accumulating
          if (fullBody.length < MIN_STANDALONE && hi + 1 < h3Items.length) {
            accum = enriched;
            accumLabel = h3Title;
            // Prepend sectionIntro context if this is the first slide and neither
            // fullBody nor enriched already contain it (avoids duplication when
            // the intro was already prepended into fullBody on line above).
            if (h3IsFirst && sec.sectionIntro
                && !fullBody.includes(sec.sectionIntro.trim())
                && !enriched.includes(sec.sectionIntro.trim())) {
              accum = sec.sectionIntro + ' ' + accum;
            }
            continue;
          }

          // Normal standalone slide
          slides.push({
            title, content: condenseSentences(fullBody, bodyLimit), bullets: null,
            subHeadingLabel: h3Title, isContinuation: !h3IsFirst,
          });
          h3IsFirst = false;
        }

        // Flush any remaining accumulated content
        flushAccum();
      }
      mainContentDone = slides.length > 0;
    }
  }

  // ── Strategy D: Paragraph-only section — split into multiple slides if long ──
  if (!mainContentDone && sec.paragraphs.length > 0) {
    const fullText = sec.paragraphs.join(' ');

    if (fullText.length <= charLimit) {
      slides.push({ title, content: fullText, bullets: null });
    } else {
      // Split by sentence groups that fit within charLimit
      // Smart regex: skip abbreviations like e.g., i.e., vs., U.S., Dr., $99.99
      const sentences = fullText.match(/[^.!?]*(?:(?:e\.g\.|i\.e\.|vs\.|etc\.|Dr\.|Mr\.|Mrs\.|Jr\.|Sr\.|\d+\.\d+)[^.!?]*)*[.!?]+/g) || [fullText];
      let currentContent = '';
      let paraIsFirst = true;

      for (const sentence of sentences) {
        if ((currentContent + sentence).length > charLimit && currentContent.length > 0) {
          slides.push({ title, content: currentContent.trim(), bullets: null, isContinuation: !paraIsFirst });
          paraIsFirst = false;
          currentContent = sentence;
        } else {
          currentContent += sentence;
        }
      }
      if (currentContent.trim().length > 10) {
        slides.push({ title, content: currentContent.trim(), bullets: null, isContinuation: !paraIsFirst });
      }
      // Merge a thin tail slide (< 30% of charLimit) back into the previous slide,
      // but only if the merged result still fits within the char limit.
      if (slides.length >= 2) {
        const last = slides[slides.length - 1];
        if (!last.bullets && last.content.length < Math.floor(charLimit * 0.3)) {
          const prev = slides[slides.length - 2];
          const merged = (prev.content + ' ' + last.content).trim();
          if (merged.length <= charLimit) {
            slides.pop();
            prev.content = merged;
          } else {
            // Can't merge without overflow — condense the previous slide to make room
            const room = charLimit - last.content.length - 1;
            if (room > Math.floor(charLimit * 0.4)) {
              prev.content = condenseSentences(prev.content, room);
              slides.pop();
              prev.content = (prev.content + ' ' + last.content).trim();
            }
            // Otherwise keep both slides — the tail is displayed with sparse layout
          }
        }
      }
    }

    // If section also has a single bullet, append it
    if (sec.bullets.length === 1 && slides.length > 0) {
      slides[slides.length - 1].bullets = sec.bullets;
    }

    mainContentDone = true;
  }

  // ── Strategy E: Bullets only, no paragraphs ──
  if (!mainContentDone && sec.bullets.length === 1) {
    slides.push({ title, content: condenseSentences(sec.bullets[0], charLimit), bullets: null });
  }

  // ── Strategy F: Callout / blockquote slides ──
  for (const callout of (sec.callouts || [])) {
    const calloutText = callout.text.length > charLimit
      ? condenseSentences(callout.text, charLimit) : callout.text;
    if (slides.length === 0) {
      // Only content is a callout — make it the primary slide
      slides.push({ title, content: calloutText, bullets: null,
        subtype: 'callout', calloutEmoji: callout.emoji, calloutText,
        calloutIsQuote: callout.isQuote || false });
    } else {
      // Attach short callout to first slide; create separate slide for long ones
      const first = slides[0];
      if (!first.calloutText && callout.text.length <= 180) {
        first.calloutEmoji = callout.emoji;
        first.calloutText = calloutText;
        first.calloutIsQuote = callout.isQuote || false;
      } else {
        slides.push({ title, content: calloutText, bullets: null,
          subtype: 'callout', calloutEmoji: callout.emoji, calloutText,
          calloutIsQuote: callout.isQuote || false });
      }
    }
  }

  // ── Strategy G: Table slide — split large tables into per-chunk slides ──
  if (sec.tableData) {
    const { headers, rows } = sec.tableData;
    const colCount = Math.max(headers.length, rows[0]?.length || 0);
    // Truncate long cell content to prevent overflow — limit scales with column count
    const maxCellLen = colCount <= 2 ? 80 : colCount <= 3 ? 55 : 40;
    const truncRows = rows.map(row => row.map(cell =>
      cell.length > maxCellLen ? cell.substring(0, maxCellLen).replace(/\s+\S*$/, '').trim() + '…' : cell
    ));
    const maxRowsPerSlide = colCount <= 2 ? 4 : colCount <= 3 ? 3 : 2;
    const insertAt = Math.min(1, slides.length);
    let insertIdx = insertAt;
    for (let start = 0; start < truncRows.length; start += maxRowsPerSlide) {
      const chunk = truncRows.slice(start, start + maxRowsPerSlide);
      slides.splice(insertIdx, 0, { title, content: '', bullets: null, subtype: 'table', tableData: { headers, rows: chunk } });
      insertIdx++;
    }
  }

  // ── Strategy H: Code block slides (only codes not already handled in Strategy C) ──
  const h3CodeSet = new Set();
  if (sec.h3CodeBlocks) for (const codes of sec.h3CodeBlocks.values()) codes.forEach(c => h3CodeSet.add(c));
  for (const code of (sec.codeBlocks || [])) {
    if (h3CodeSet.has(code)) continue;
    const lines = code.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
    const codeText = lines.join('\n').substring(0, 300);
    if (codeText.length > 5) {
      slides.push({ title, content: codeText, bullets: null, subtype: 'code' });
    }
  }

  return slides;
};

function extractContentSlides(html, featureImage, limits, maxSlides, density = 'balanced') {
  if (!html) return [];
  const L = limits || LIMITS;
  const effectiveMaxSlides = maxSlides || DENSITY_PRESETS.balanced.maxSlides;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const { sections } = parseSections(doc, featureImage);

  // Detect embedded YouTube videos
  const ytEmbeds = findYouTubeEmbeds(doc);

  if (sections.length === 0) {
    const results = [];
    const paragraphs = doc.querySelectorAll('p');
    let collected = '';
    for (const p of paragraphs) {
      for (const br of p.querySelectorAll('br')) br.replaceWith(' ');
      collected += ' ' + p.innerText;
    }
    collected = collected.trim();
    if (collected.length > 20) {
      results.push({
        title: 'Key Insight',
        content: condenseSentences(collected, L.contentCharLimit),
        bullets: null,
        imageSlide: false,
        image: null,
        videoUrl: ytEmbeds.length > 0 ? ytEmbeds[0].url : null,
      });
    }
    return results;
  }

  // Max content slide budget (total slides minus cover + CTA)
  const maxContent = effectiveMaxSlides - 2;

  // ── Merge thin sections ──
  // If a section has very little total content (paragraphs + bullets combined),
  // merge it into the previous section so it doesn't waste a whole slide.
  // Concise mode: merge aggressively (fewer, denser slides).
  // Detailed mode: merge less (preserve more section boundaries).
  const THIN_THRESHOLD = density === 'concise' ? 400 : density === 'detailed' ? 150 : 250;
  const merged = [];
  for (const sec of sections) {
    const paraChars = sec.paragraphs.join(' ').length;
    const bulletChars = sec.bullets.reduce((sum, b) => sum + b.length, 0);
    const totalChars = paraChars + bulletChars;
    const isThin = totalChars < THIN_THRESHOLD && sec.bullets.length <= 1 && !sec.image && sec.subHeadings.length === 0 && !sec.tableData && sec.codeBlocks.length === 0 && sec.callouts.length === 0;
    if (isThin && merged.length > 0) {
      const prev = merged[merged.length - 1];
      // Convert single bullets to paragraphs for clean merge
      if (sec.bullets.length === 1) prev.paragraphs.push(sec.bullets[0]);
      prev.paragraphs.push(...sec.paragraphs);
    } else {
      merged.push(sec);
    }
  }

  // Expand every section into slide(s)
  const sectionSlides = [];
  let imageSlideCount = 0;

  for (const sec of merged) {
    const expanded = expandSection(sec, L);
    if (expanded.length === 0) continue;
    if (sec.image && imageSlideCount < MAX_IMG_SLIDES) {
      expanded[0].imageSlide = true;
      expanded[0].image = sec.image;
      expanded[0].imageCaption = sec.imageCaption || null;
      imageSlideCount++;
    }
    sectionSlides.push(expanded);
  }

  // Multi-pass round-robin allocation:
  // Phase 1: every section gets 1 slide (all topics covered).
  // Phase 2+: distribute remaining budget round-robin to sections
  // that have more expanded slides, preserving section order.
  const numSections = sectionSlides.length;
  if (numSections === 0) return [];

  const taken = new Array(numSections).fill(0);
  let totalTaken = 0;

  // Phase 2+: distribute remaining budget round-robin, capped per-section to prevent splits
  // concise: 1 slide per section (no continuation), balanced: 2, detailed: 3 max
  const maxPerSection = density === 'concise' ? 1 : density === 'detailed' ? 3 : 2;

  // Phase 1: one slide per section (sections with a code slide get a second guaranteed slot,
  // but only when the per-section cap allows it)
  for (let i = 0; i < numSections && totalTaken < maxContent; i++) {
    if (sectionSlides[i].length > 0) {
      taken[i] = 1;
      totalTaken++;
      // Guarantee the code slide for sections that have one, if budget and cap allow
      if (
        sectionSlides[i].length >= 2 &&
        sectionSlides[i].some(s => s.subtype === 'code') &&
        totalTaken < maxContent &&
        taken[i] + 1 <= maxPerSection
      ) {
        taken[i] = 2;
        totalTaken++;
      }
    }
  }
  let changed = true;
  while (totalTaken < maxContent && changed) {
    changed = false;
    for (let i = 0; i < numSections && totalTaken < maxContent; i++) {
      if (taken[i] < sectionSlides[i].length && taken[i] < maxPerSection) {
        taken[i]++;
        totalTaken++;
        changed = true;
      }
    }
  }

  // Build final slides in section order
  let allSlides = [];
  for (let i = 0; i < numSections; i++) {
    allSlides.push(...sectionSlides[i].slice(0, taken[i]));
  }

  // Safety cap
  if (allSlides.length > maxContent) {
    allSlides = allSlides.slice(0, maxContent);
  }

  // Finalize slide objects
  const results = allSlides.map(s => ({
    title: s.title,
    content: s.content || '',
    bullets: s.bullets || null,
    imageSlide: s.imageSlide || false,
    image: s.image || null,
    imageCaption: s.imageCaption || null,
    isContinuation: s.isContinuation || false,
    subtype: s.subtype || null,
    tableData: s.tableData || null,
    calloutEmoji: s.calloutEmoji || '',
    calloutText: s.calloutText || '',
    calloutIsQuote: s.calloutIsQuote || false,
    codeSubtitle: s.codeSubtitle || '',
    codeCaption: s.codeCaption || '',
  }));

  // Attach YouTube URL to first content slide if present
  if (ytEmbeds.length > 0 && results.length > 0) {
    results[0].videoUrl = ytEmbeds[0].url;
  }

  return results;
};

export const createBlankSlide = (type = 'content', number = 1) => {
  return {
    id: `slide-new-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    type,
    title: type === 'content' ? 'New Slide' : type === 'cover' ? 'Title' : 'Read More',
    content: type === 'content' ? 'Your content here...' : undefined,
    subtitle: type !== 'content' ? CONFIG.brand.domain : undefined,
    number: type === 'content' ? number : undefined,
    bullets: null,
    imageSlide: false,
    image: null,
    parallaxGroup: null,
    parallaxPosition: null,
    videoUrl: null,
  };
};
