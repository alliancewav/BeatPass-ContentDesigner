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
    // Truncate very long titles at word boundary
    if (rawTitle.length > MAX_TITLE_LEN) {
      rawTitle = rawTitle.substring(0, MAX_TITLE_LEN).replace(/\s+\S*$/, '').trim() || rawTitle.substring(0, MAX_TITLE_LEN);
    }
    const section = {
      title: rawTitle,
      paragraphs: [],
      bullets: [],
      image: null,
      subHeadings: [],        // H3 titles within this section
      h3Paragraphs: new Map(), // H3 title → [following paragraphs] (for FAQ Q&A)
      sectionIntro: null,      // First paragraph BEFORE any H3 (true intro, not an H3 answer)
    };

    // Walk siblings until next H2, capturing H3 context
    let node = h2.nextElementSibling;
    const listNodes = [];
    let currentH3 = null; // Track which H3 we're under
    let lastParaBeforeFirstList = null; // Track the paragraph that introduces the first bullet list
    let hitFirstList = false;
    let hitFirstH3 = false; // Track whether we've seen an H3 yet

    while (node) {
      if (node.tagName === 'H2') break;

      if (node.tagName === 'H3') {
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

      // Capture first image in section only
      if (!section.image) {
        const src = extractImgSrc(node);
        if (src) section.image = useImage(src);
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
  });

  // 2. Content slides
  const contentSlides = extractContentSlides(article.html, article.featureImage, densityLimits, maxSlides);
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

const expandSection = (sec, limits) => {
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

  // Skip "next reads" / link-list sections
  const isLinkList = (titleLower.includes('next read') || titleLower.includes('related') || titleLower.includes('further reading'))
    && sec.paragraphs.length === 0;
  if (isLinkList) return slides;

  const isFaqPattern = ['faqs', 'faq', 'common misconceptions', 'myths', 'common questions'].includes(titleLower)
    || (titleLower.includes('misconception') || titleLower.includes('myth') || titleLower.includes('faq'));
  const isFaqSection = isFaqPattern && sec.subHeadings.length >= 2;

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
    if (slides.length > 0) return slides;
  }

  // ── Strategy B: Section with bullets ──
  // Bullet counts derived from pixel-budget math in layoutEngine:
  //   With intro text: maxBulletsIntro — title + intro + bullets must fit square canvas
  //   Without intro:   maxBullets — title + bullets only
  if (sec.bullets.length >= 2) {
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

    // Continuation slides for remaining bullets (no intro = more room)
    for (let i = firstCount; i < allBullets.length; i += maxBullets) {
      const chunk = allBullets.slice(i, i + maxBullets);
      slides.push({
        title: `${title} (cont.)`,
        content: '',
        bullets: chunk,
      });
    }
    return slides;
  }

  // ── Strategy C: Section with H3 subheadings (non-FAQ) ──
  // Preserve H3 titles by prepending them to their paragraph blocks.
  // This keeps hierarchical context that would otherwise be lost.
  if (sec.subHeadings.length >= 2 && sec.h3Paragraphs.size >= 2) {
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
      if (fullText.length <= charLimit) {
        slides.push({ title, content: fullText, bullets: null });
      } else {
        // One slide per H3 sub-section for deep reading
        if (sec.sectionIntro) {
          slides.push({ title, content: condenseSentences(sec.sectionIntro, charLimit), bullets: null });
        }
        for (const [h3Title, paras] of sec.h3Paragraphs) {
          const body = paras.join(' ');
          if (body.length < 20) continue;
          let slideTitle = h3Title.length > maxTitleLen
            ? h3Title.substring(0, maxTitleLen).replace(/\s+\S*$/, '').trim()
            : h3Title;
          slides.push({ title: slideTitle, content: condenseSentences(body, charLimit), bullets: null });
        }
      }
      if (slides.length > 0) return slides;
    }
  }

  // ── Strategy D: Paragraph-only section — split into multiple slides if long ──
  if (sec.paragraphs.length > 0) {
    const fullText = sec.paragraphs.join(' ');

    if (fullText.length <= charLimit) {
      slides.push({ title, content: fullText, bullets: null });
    } else {
      // Split by sentence groups that fit within charLimit
      // Smart regex: skip abbreviations like e.g., i.e., vs., U.S., Dr., $99.99
      const sentences = fullText.match(/[^.!?]*(?:(?:e\.g\.|i\.e\.|vs\.|etc\.|Dr\.|Mr\.|Mrs\.|Jr\.|Sr\.|\d+\.\d+)[^.!?]*)*[.!?]+/g) || [fullText];
      let currentContent = '';
      let slideIdx = 0;

      for (const sentence of sentences) {
        if ((currentContent + sentence).length > charLimit && currentContent.length > 0) {
          const slideTitle = slideIdx === 0 ? title : `${title} (cont.)`;
          slides.push({ title: slideTitle, content: currentContent.trim(), bullets: null });
          currentContent = sentence;
          slideIdx++;
        } else {
          currentContent += sentence;
        }
      }
      if (currentContent.trim().length > 10) {
        const slideTitle = slideIdx === 0 ? title : `${title} (cont.)`;
        slides.push({ title: slideTitle, content: currentContent.trim(), bullets: null });
      }
    }

    // If section also has a single bullet, append it
    if (sec.bullets.length === 1 && slides.length > 0) {
      slides[slides.length - 1].bullets = sec.bullets;
    }

    return slides;
  }

  // ── Strategy E: Bullets only, no paragraphs ──
  if (sec.bullets.length === 1) {
    slides.push({ title, content: condenseSentences(sec.bullets[0], charLimit), bullets: null });
  }

  return slides;
};

const extractContentSlides = (html, featureImage, limits, maxSlides) => {
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
  const THIN_THRESHOLD = 250;
  const merged = [];
  for (const sec of sections) {
    const paraChars = sec.paragraphs.join(' ').length;
    const bulletChars = sec.bullets.reduce((sum, b) => sum + b.length, 0);
    const totalChars = paraChars + bulletChars;
    const isThin = totalChars < THIN_THRESHOLD && sec.bullets.length <= 1 && !sec.image && sec.subHeadings.length === 0;
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

  // Phase 1: one slide per section
  for (let i = 0; i < numSections && totalTaken < maxContent; i++) {
    if (sectionSlides[i].length > 0) {
      taken[i] = 1;
      totalTaken++;
    }
  }

  // Phase 2+: distribute remaining budget round-robin
  let changed = true;
  while (totalTaken < maxContent && changed) {
    changed = false;
    for (let i = 0; i < numSections && totalTaken < maxContent; i++) {
      if (taken[i] < sectionSlides[i].length) {
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
