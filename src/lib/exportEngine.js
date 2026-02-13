// ─── Export Engine ───
// Renders slides to PNG using html-to-image (SVG foreignObject approach).
// Unlike html2canvas, this uses the browser's native CSS rendering engine,
// so flexbox alignment, line-height, SVG icons etc. are pixel-perfect.

import { toPng, toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Transparent 1×1 PNG data URI — used as fallback when an image can't be fetched
const TRANSPARENT_PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12NgYGBgAAAABQABXvMqOgAAAABJRU5ErkJggg==';

// Fetch a blob with CORS fallback: try direct cors fetch, then no-cors proxy, then give up
const fetchBlobWithFallback = async (url) => {
  // 1. Try direct CORS fetch
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) return await res.blob();
  } catch { /* CORS blocked — try proxy */ }

  // 2. Try same-origin image proxy (video-api or a simple relay)
  try {
    const proxyUrl = `/video-api/image-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) return await res.blob();
  } catch { /* proxy unavailable */ }

  return null;
};

const blobToDataUri = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Failed to read blob'));
  reader.onloadend = () => {
    if (reader.result) resolve(reader.result);
    else reject(new Error('FileReader returned null result'));
  };
  reader.readAsDataURL(blob);
});

// Convert any cross-origin <img> elements to inline data URIs
// so the foreignObject serialization doesn't hit CORS errors.
const inlineImages = async (element) => {
  const imgs = element.querySelectorAll('img');
  const promises = Array.from(imgs).map(async (img) => {
    if (!img.src || img.src.startsWith('data:')) return;
    // Skip same-origin images (they serialize fine)
    try {
      const imgUrl = new URL(img.src, window.location.origin);
      if (imgUrl.origin === window.location.origin) return;
    } catch { return; }
    try {
      const blob = await fetchBlobWithFallback(img.src);
      if (blob && blob.size > 0 && blob.type !== 'text/html') {
        const dataUri = await blobToDataUri(blob);
        if (dataUri && dataUri.startsWith('data:image')) {
          img.src = dataUri;
          return;
        }
      }
      // If all fetches failed, replace with transparent pixel so export doesn't crash
      console.warn('Replacing unreachable image with transparent pixel:', img.src);
      img.src = TRANSPARENT_PX;
    } catch (err) {
      console.warn('Failed to inline image, using transparent fallback:', img.src, err);
      img.src = TRANSPARENT_PX;
    }
  });
  await Promise.all(promises);
};

export const captureElement = async (element, width, height) => {
  if (!element) throw new Error('No element to capture');

  // Inline cross-origin images before capture
  await inlineImages(element);

  const dataUrl = await toPng(element, {
    width,
    height,
    pixelRatio: 1,
    skipAutoScale: true,
    cacheBust: true,
    // Skip cross-origin stylesheets that throw SecurityError on cssRules access
    includeQueryParams: true,
    skipFonts: false,
    filter: (node) => {
      if (node.tagName === 'SCRIPT' || node.tagName === 'NOSCRIPT') return false;
      // Skip external link stylesheets to avoid CORS cssRules errors
      if (node.tagName === 'LINK' && node.rel === 'stylesheet' && node.href) {
        try {
          const u = new URL(node.href, window.location.origin);
          if (u.origin !== window.location.origin) return false;
        } catch { /* keep */ }
      }
      return true;
    },
  });

  return dataUrl;
};

export const captureElementAsBlob = async (element, width, height) => {
  if (!element) throw new Error('No element to capture');

  await inlineImages(element);

  const blob = await toBlob(element, {
    width,
    height,
    pixelRatio: 1,
    skipAutoScale: true,
    cacheBust: true,
    filter: (node) => {
      if (node.tagName === 'SCRIPT' || node.tagName === 'NOSCRIPT') return false;
      return true;
    },
  });

  return blob;
};

// Capture an element as a transparent PNG (for video overlay compositing).
// The element should be rendered with overlayOnly=true so background is transparent.
export const captureOverlayAsPng = async (element, width, height) => {
  if (!element) throw new Error('No element to capture for overlay');
  await inlineImages(element);
  const dataUrl = await toPng(element, {
    width,
    height,
    pixelRatio: 1,
    skipAutoScale: true,
    cacheBust: true,
    backgroundColor: 'transparent',
    includeQueryParams: true,
    skipFonts: false,
    filter: (node) => {
      if (node.tagName === 'SCRIPT' || node.tagName === 'NOSCRIPT') return false;
      if (node.tagName === 'LINK' && node.rel === 'stylesheet' && node.href) {
        try {
          const u = new URL(node.href, window.location.origin);
          if (u.origin !== window.location.origin) return false;
        } catch { /* keep */ }
      }
      return true;
    },
  });
  return dataUrl;
};

export const downloadSingleSlide = async (element, width, height, filename) => {
  const dataUrl = await captureElement(element, width, height);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
};

// Strip Ghost image CDN transforms (e.g. /size/w300/format/webp/) to get the raw original URL.
// Ghost converts GIFs to WebP when these transforms are present, losing animation.
export const stripGhostImageTransforms = (url) => {
  if (!url) return url;
  try {
    const u = new URL(url);
    // Ghost pattern: /content/images/size/{spec}/format/{fmt}/YYYY/MM/file.ext
    // Strip /size/.../ and /format/.../ segments (plus trailing slash) to get /content/images/YYYY/MM/file.ext
    u.pathname = u.pathname
      .replace(/\/size\/[^/]+\/?/, '/')
      .replace(/\/format\/[^/]+\/?/, '/')
      .replace(/\/{2,}/g, '/');
    return u.href;
  } catch { return url; }
};

// Detect if a URL points to a GIF (by extension, path segment, or known CDN patterns)
export const isGifUrl = (url) => {
  if (!url) return false;
  try {
    const u = new URL(url, window.location.origin);
    const lower = u.pathname.toLowerCase();
    // Direct .gif extension (with or without query params)
    if (lower.endsWith('.gif')) return true;
    // .gif as a path segment (e.g. /image.gif/variant or /image.gif?params)
    if (/\.gif(?=\/|\?|$)/.test(lower)) return true;
    // Known GIF CDN hostnames
    const host = u.hostname.toLowerCase();
    if (host.includes('giphy.com') || host.includes('tenor.com')) return true;
    return false;
  } catch { return false; }
};

export const downloadAllAsZip = async ({
  renderSlideAtIndex,
  totalSlides,
  width,
  height,
  slugName,
  slides = [],
  videoExportFn = null,
  ytVideoExportFn = null,
  gifToMp4Fn = null,
} = {}) => {
  const zip = new JSZip();
  const folder = zip.folder(slugName || 'carousel');

  for (let i = 0; i < totalSlides; i++) {
    const element = await renderSlideAtIndex(i);
    if (!element) continue;

    const paddedIndex = String(i + 1).padStart(2, '0');
    const slide = slides[i];
    const hasYtVideo = slide?.videoUrl && ytVideoExportFn;
    const hasGifImage = slide?.imageSlide && isGifUrl(slide?.image);

    if (hasYtVideo) {
      // YouTube video slide → server-side yt-dlp + ffmpeg (60s, with audio)
      try {
        const mp4Blob = await ytVideoExportFn(slide, i);
        folder.file(`slide-${paddedIndex}.mp4`, mp4Blob);
      } catch (err) {
        console.warn(`YouTube export failed for slide ${i + 1}, falling back to PNG:`, err);
        const blob = await captureElementAsBlob(element, width, height);
        folder.file(`slide-${paddedIndex}.png`, blob);
      }
    } else if (hasGifImage && gifToMp4Fn) {
      // GIF image slide → capture as still-frame MP4 for Instagram compatibility
      try {
        const mp4Blob = await gifToMp4Fn(element, i, width, height);
        folder.file(`slide-${paddedIndex}.mp4`, mp4Blob);
      } catch (err) {
        console.warn(`GIF→MP4 export failed for slide ${i + 1}, falling back to PNG:`, err);
        const blob = await captureElementAsBlob(element, width, height);
        folder.file(`slide-${paddedIndex}.png`, blob);
      }
    } else {
      // Static slide → PNG
      const blob = await captureElementAsBlob(element, width, height);
      folder.file(`slide-${paddedIndex}.png`, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${slugName || 'carousel'}.zip`);
};

export const downloadAllIndividual = async (renderSlideAtIndex, totalSlides, width, height) => {
  for (let i = 0; i < totalSlides; i++) {
    const element = await renderSlideAtIndex(i);
    if (!element) continue;

    const dataUrl = await captureElement(element, width, height);
    const link = document.createElement('a');
    link.href = dataUrl;
    const paddedIndex = String(i + 1).padStart(2, '0');
    link.download = `slide-${paddedIndex}.png`;
    link.click();
    await new Promise((r) => setTimeout(r, 300));
  }
};
