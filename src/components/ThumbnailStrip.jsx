import React, { useRef, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import SlideCanvas from './SlideCanvas';
import { computeLayout } from '../lib/layoutEngine';

const SUBTYPE_LABELS = { code: '</>', table: '▦', callout: '✦' };

const badgeBaseClass = 'absolute bottom-0.5 left-0.5 z-10 bg-black/70 rounded px-1 leading-none';
const badgeBaseStyle = { fontSize: 7, fontFamily: 'monospace', fontWeight: 700, paddingTop: 2, paddingBottom: 2 };

function getBadgeConfig(slide) {
  if (slide.subtype) return {
    label: SUBTYPE_LABELS[slide.subtype] || slide.subtype.toUpperCase(),
    color: 'rgba(167,139,250,0.9)',
    className: badgeBaseClass + ' backdrop-blur-sm',
    letterSpacing: '0.05em',
  };
  if (slide.imageSlide) return {
    label: 'IMG',
    color: 'rgba(251,191,36,0.9)',
    className: badgeBaseClass + ' backdrop-blur-sm',
  };
  if (slide.type === 'cover') return {
    label: 'CVR',
    color: 'rgba(167,139,250,0.7)',
    className: badgeBaseClass,
  };
  if (slide.type === 'cta') return {
    label: 'CTA',
    color: 'rgba(167,139,250,0.7)',
    className: badgeBaseClass,
  };
  return null;
}

export default function ThumbnailStrip({ slides, currentIndex, onSelect, onReorder, theme, aspectRatio, imageCache }) {
  const containerRef = useRef(null);
  const dragFromRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const isPortrait = aspectRatio === 'portrait';
  const thumbW = isPortrait ? 72 : 90;
  const thumbH = isPortrait ? 90 : 72;
  const slideW = 1080;
  const slideH = isPortrait ? 1350 : 1080;
  const thumbScale = thumbW / slideW;

  useEffect(() => {
    if (containerRef.current) {
      const items = containerRef.current.querySelectorAll('[data-thumb]');
      const active = items[currentIndex];
      if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentIndex]);

  const handleDragStart = (e, i) => {
    dragFromRef.current = i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };

  const handleDragOver = (e, i) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== i) setDragOver(i);
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    const from = dragFromRef.current;
    if (from !== null && from !== toIndex) onReorder?.(from, toIndex);
    dragFromRef.current = null;
    setDragOver(null);
  };

  const handleDragEnd = () => {
    dragFromRef.current = null;
    setDragOver(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto py-2 px-2 scrollbar-none items-end"
      style={{ scrollbarWidth: 'none' }}
    >
      {slides.map((slide, i) => {
        const isActive = i === currentIndex;
        const isDropTarget = dragOver === i && dragFromRef.current !== i;
        return (
          <div
            key={slide.id}
            data-thumb
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            className="flex-shrink-0 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing select-none"
            style={{ opacity: isDropTarget ? 0.4 : 1, transition: 'opacity 0.15s' }}
          >
            <button
              onClick={() => onSelect(i)}
              className={`rounded-md overflow-hidden relative transition-all duration-150 ${
                isActive
                  ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-neutral-950 scale-105'
                  : isDropTarget
                  ? 'ring-2 ring-violet-400/50'
                  : 'opacity-55 hover:opacity-90'
              }`}
              style={{
                width: thumbW,
                height: thumbH,
                border: isActive ? '1.5px solid rgb(139,92,246)' : '1.5px solid rgba(255,255,255,0.07)',
              }}
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
              {/* Slide type badge — single badge, priority: subtype > imageSlide > cover/cta */}
              {(() => {
                const cfg = getBadgeConfig(slide);
                if (!cfg) return null;
                return (
                  <div className={cfg.className}
                    style={{ ...badgeBaseStyle, color: cfg.color, letterSpacing: cfg.letterSpacing }}>
                    {cfg.label}
                  </div>
                );
              })()}
              {slide.isContinuation && !slide.subtype && (
                <div className="absolute top-0.5 left-0.5 z-10 bg-black/70 backdrop-blur-sm rounded px-1 leading-none"
                  style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(148,163,184,0.8)', fontWeight: 700, paddingTop: 2, paddingBottom: 2 }}>
                  +
                </div>
              )}
              {slide.type === 'content' && !slide.playerLayout && (() => {
                const lo = computeLayout(slide, isPortrait);
                const pct = Math.round(lo.fillRatio * 100);
                if (lo.fillRatio <= 1.0) return null;
                const color = lo.fillRatio > 1.2 ? '#ef4444' : '#f59e0b';
                return (
                  <div className="absolute top-0.5 right-0.5 z-10" title={`Content overflow: ${pct}% of available space used`}>
                    <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shadow" style={{ backgroundColor: color }}>
                      <AlertTriangle size={8} className="text-black" strokeWidth={3} />
                    </div>
                  </div>
                );
              })()}
            </button>
            {/* Slide number */}
            <span className={`text-[9px] font-mono leading-none transition-colors ${isActive ? 'text-violet-400' : 'text-white/20'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
