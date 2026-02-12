// ─── Slide Generation Engine ───
// Converts a parsed Ghost article into an array of slide objects.
// "Mini landing page" style: clean text slides + max 2 dedicated image slides.

import CONFIG from '../config';

const { maxSlides: MAX_SLIDES, targetContentSlides: TARGET, contentCharLimit: CHAR_LIMIT,
        bulletCharLimit: BULLET_LIMIT, maxBulletsPerSlide: MAX_BULLETS,
        maxImageSlides: MAX_IMG_SLIDES, maxTitleLen: MAX_TITLE_LEN,
        bulletTitleThreshold: BULLET_TITLE_THRESHOLD } = CONFIG.slides;

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

const extractImgSrc = (node) => {
  if (!node) return null;
  if (node.tagName === 'IMG' && node.src) return node.src;
  if (node.tagName === 'FIGURE' || (node.classList && (
    node.classList.contains('kg-image-card') ||
    node.classList.contains('kg-gallery-card') ||
    node.classList.contains('kg-card')
  ))) {
    const img = node.querySelector('img');
    if (img && img.src) return img.src;
  }
  return null;
};

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
    if ((result + s).length > limit && result.length > 0) break;
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
  // Fall back to word boundary + ellipsis
  const wordBound = chunk.replace(/\s+\S*$/, '').trim();
  return (wordBound || chunk) + '…';
};

const extractBullets = (listNodes) => {
  const bullets = [];
  for (const list of listNodes) {
    const items = list.querySelectorAll('li');
    for (const li of items) {
      if (bullets.length >= MAX_BULLETS) break;
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
  const h2s = doc.querySelectorAll('h2');

  for (const h2 of h2s) {
    let rawTitle = h2.innerText.replace(/\s+/g, ' ').trim();
    // Truncate very long titles at word boundary (max ~65 chars for slide readability)
    if (rawTitle.length > MAX_TITLE_LEN) {
      rawTitle = rawTitle.substring(0, MAX_TITLE_LEN).replace(/\s+\S*$/, '').trim() || rawTitle.substring(0, MAX_TITLE_LEN);
    }
    const section = {
      title: rawTitle,
      paragraphs: [],
      bullets: [],
      image: null,
    };

    // Only look FORWARD within the section for images (not backward —
    // backward lookup picks up promo banners and website screenshots)

    // Walk siblings until next H2
    let node = h2.nextElementSibling;
    const listNodes = [];

    while (node) {
      if (node.tagName === 'H2') break;
      if (node.tagName === 'H3') { node = node.nextElementSibling; continue; }

      // Capture first image in section only
      if (!section.image) {
        const src = extractImgSrc(node);
        if (src) section.image = useImage(src);
      }

      if (node.tagName === 'P') {
        for (const br of node.querySelectorAll('br')) br.replaceWith(' ');
        const text = node.innerText.replace(/\s+/g, ' ').trim();
        if (text.length > 15) section.paragraphs.push(text);
      }

      if (node.tagName === 'UL' || node.tagName === 'OL') {
        listNodes.push(node);
      }

      node = node.nextElementSibling;
    }

    if (listNodes.length > 0) {
      section.bullets = extractBullets(listNodes);
    }

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

export const generateSlides = (article) => {
  // Check if this is a beat/video article (requires #video + #video-preview tags + track URL)
  if (isBeatArticle(article)) {
    const beatMeta = parseBeatMeta(article.html);
    if (beatMeta) return generateBeatSlides(article, beatMeta);
  }

  const slides = [];

  // 1. Cover slide
  slides.push({
    id: `slide-cover-${Date.now()}`,
    type: 'cover',
    title: article.title,
    subtitle: article.primaryTag || CONFIG.brand.domain,
    readingTime: `${article.readingTime} min read`,
    featureImage: article.featureImage,
  });

  // 2. Content slides
  const contentSlides = extractContentSlides(article.html, article.featureImage);
  contentSlides.forEach((cs, idx) => {
    if (slides.length >= MAX_SLIDES - 1) return;
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
    });
  });

  // 3. Fallback: generate from excerpt
  if (contentSlides.length === 0 && article.excerpt) {
    slides.push({
      id: `slide-excerpt-${Date.now()}`,
      type: 'content',
      title: 'Key Takeaway',
      content: condenseSentences(article.excerpt, CHAR_LIMIT),
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
    featureImage: article.featureImage,
  });

  // Re-number content slides
  let num = 0;
  slides.forEach((s) => { if (s.type === 'content') { num++; s.number = num; } });

  return slides;
};

const extractContentSlides = (html, featureImage) => {
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const { sections } = parseSections(doc, featureImage);

  // Detect embedded YouTube videos — store for videoUrl on slides, but
  // DON'T auto-create dedicated "Watch the Video" thumbnail slides.
  // YouTube thumbnails look bad as full-bleed backgrounds.
  const ytEmbeds = findYouTubeEmbeds(doc);

  if (sections.length === 0) {
    const results = [];

    // Fallback: collect paragraphs
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
        content: condenseSentences(collected, CHAR_LIMIT),
        bullets: null,
        imageSlide: false,
        image: null,
        // Attach YouTube URL to first slide so user can export video if desired
        videoUrl: ytEmbeds.length > 0 ? ytEmbeds[0].url : null,
      });
    }
    return results;
  }

  // Budget: pick top N sections, scored by content richness
  const budget = Math.min(TARGET.max, Math.max(TARGET.min, sections.length));

  // Score each section: longer paragraphs and more bullets = better content for carousel
  const scored = sections.map((sec, i) => {
    const textLen = sec.paragraphs.join(' ').length;
    const bulletScore = sec.bullets.length * 40;
    const hasImage = sec.image ? 20 : 0;
    // Slight bonus for earlier sections (more important context)
    const posBonus = Math.max(0, 10 - i * 2);
    // Penalize link-list / "next reads" sections (bullets only, no paragraphs, near end)
    const titleLower = sec.title.toLowerCase();
    const isLinkList = (titleLower.includes('next read') || titleLower.includes('related') || titleLower.includes('further reading'))
      && sec.paragraphs.length === 0;
    const penalty = isLinkList ? -200 : 0;
    return { sec, idx: i, score: textLen + bulletScore + hasImage + posBonus + penalty };
  });

  // If we have more sections than budget, pick the highest-scoring ones
  // but preserve their original order for narrative flow
  let selected;
  if (sections.length <= budget) {
    selected = scored;
  } else {
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const topIndices = sorted.slice(0, budget).map(s => s.idx).sort((a, b) => a - b);
    selected = topIndices.map(i => scored[i]);
  }

  const results = [];
  let imageSlideCount = 0;

  for (const { sec } of selected) {
    if (!sec) continue;

    // Decide: bullets with optional intro, or text-only
    let content = '';
    let bullets = null;
    if (sec.bullets.length >= 2) {
      // Adaptive bullet count: long titles (3+ lines at 90px) get fewer bullets to fit safe zone
      const titleLen = Math.min((sec.title || '').length, MAX_TITLE_LEN);
      const maxBullets = titleLen > BULLET_TITLE_THRESHOLD ? 2 : MAX_BULLETS;
      bullets = sec.bullets.slice(0, maxBullets);
    } else if (sec.bullets.length === 1 && sec.paragraphs.length === 0) {
      // Single bullet with no paragraphs: use bullet text as body content
      content = condenseSentences(sec.bullets[0], CHAR_LIMIT);
    } else {
      const fullText = sec.paragraphs.join(' ');
      content = condenseSentences(fullText, CHAR_LIMIT);
    }

    // Is this an image slide? Only if section has an image AND we haven't hit the cap
    const isImageSlide = !!(sec.image && imageSlideCount < MAX_IMG_SLIDES);
    if (isImageSlide) imageSlideCount++;

    if (content.length > 10 || (bullets && bullets.length > 0) || isImageSlide) {
      results.push({
        title: sec.title,
        content: isImageSlide ? '' : content,
        bullets: isImageSlide ? null : bullets,
        imageSlide: isImageSlide,
        image: isImageSlide ? sec.image : null,
      });
    }
  }

  // If there are YouTube embeds, attach the URL to the first content slide
  // so users can optionally export video — but don't create a dedicated video slide
  if (ytEmbeds.length > 0 && results.length > 0) {
    results[0].videoUrl = ytEmbeds[0].url;
  }

  // Safety cap: never exceed maxSlides (minus cover + CTA = 2)
  return results.slice(0, MAX_SLIDES - 2);
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
