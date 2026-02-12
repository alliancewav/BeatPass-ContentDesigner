// ─── Export Engine ───
// Renders slides to PNG using html-to-image (SVG foreignObject approach).
// Unlike html2canvas, this uses the browser's native CSS rendering engine,
// so flexbox alignment, line-height, SVG icons etc. are pixel-perfect.

import { toPng, toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
      const res = await fetch(img.src, { mode: 'cors' });
      const blob = await res.blob();
      const dataUri = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      img.src = dataUri;
    } catch (err) {
      console.warn('Failed to inline image:', img.src, err);
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

export const downloadAllAsZip = async (renderSlideAtIndex, totalSlides, width, height, slugName, slides = [], videoExportFn = null, ytVideoExportFn = null) => {
  const zip = new JSZip();
  const folder = zip.folder(slugName || 'carousel');

  for (let i = 0; i < totalSlides; i++) {
    const element = await renderSlideAtIndex(i);
    if (!element) continue;

    const paddedIndex = String(i + 1).padStart(2, '0');
    const slide = slides[i];
    const hasYtVideo = slide?.videoUrl && ytVideoExportFn;

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
    } else {
      // Static slide → PNG
      const blob = await captureElementAsBlob(element, width, height);
      folder.file(`slide-${paddedIndex}.png`, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${slugName || 'carousel'}-slides.zip`);
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
