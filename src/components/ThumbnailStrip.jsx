import React, { useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import SlideCanvas from './SlideCanvas';
import { computeLayout } from '../lib/layoutEngine';

export default function ThumbnailStrip({ slides, currentIndex, onSelect, theme, aspectRatio, imageCache }) {
  const containerRef = useRef(null);
  const isPortrait = aspectRatio === 'portrait';
  // Responsive thumbnail sizes — smaller on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const thumbW = isMobile ? 56 : 80;
  const thumbH = isPortrait ? (isMobile ? 70 : 100) : (isMobile ? 56 : 80);
  const slideW = 1080;
  const slideH = isPortrait ? 1350 : 1080;
  const thumbScale = thumbW / slideW;

  useEffect(() => {
    if (containerRef.current) {
      const active = containerRef.current.children[currentIndex];
      if (active) {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-none"
      style={{ scrollbarWidth: 'none' }}
    >
      {slides.map((slide, i) => (
        <button
          key={slide.id}
          onClick={() => onSelect(i)}
          className={`flex-shrink-0 rounded-lg border-2 transition-all overflow-hidden relative ${
            i === currentIndex
              ? 'border-violet-500 ring-2 ring-violet-500/30 scale-105'
              : 'border-white/[0.06] hover:border-white/20 opacity-60 hover:opacity-100'
          }`}
          style={{ width: thumbW, height: thumbH }}
        >
          <div style={{
            width: slideW,
            height: slideH,
            transform: `scale(${thumbScale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}>
            <SlideCanvas
              slide={slide}
              index={i}
              totalSlides={slides.length}
              theme={theme}
              aspectRatio={aspectRatio}
              imageCache={imageCache}
            />
          </div>
          {slide.type === 'content' && !slide.playerLayout && (() => {
            const lo = computeLayout(slide, isPortrait);
            return lo.fillRatio > 1.0 ? (
              <div className="absolute -top-1 -right-1 z-10" title={`Content overflows (${Math.round(lo.fillRatio * 100)}% fill)`}>
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                  <AlertTriangle size={9} className="text-black" strokeWidth={3} />
                </div>
              </div>
            ) : null;
          })()}
        </button>
      ))}
    </div>
  );
}
