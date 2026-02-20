import React, { useRef, useEffect, useState } from 'react';
import StoryCanvas from './StoryCanvas';

const TYPE_BADGE_MAP = { hook: 'HK', teaser: 'TSR', tip: 'TIP', quote: '❝', poll: 'POLL', cta: 'CTA' };

const THUMB_W = 48;
const THUMB_H = 86;
const FRAME_W = 1080;
const FRAME_H = 1920;
const SCALE = THUMB_W / FRAME_W;

export default function StoryThumbnailStrip({ frames, currentIndex, onSelect, onReorder, theme, imageCache, coverOverride, coverYouTubeId, coverMediaMode }) {
  const containerRef = useRef(null);
  const dragFromRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    if (containerRef.current) {
      const items = containerRef.current.querySelectorAll('[data-story-thumb]');
      const active = items[currentIndex];
      if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentIndex]);

  if (!frames || frames.length === 0) return null;

  const handleDragStart = (e, i) => {
    dragFromRef.current = i;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, i) => {
    e.preventDefault();
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
      {frames.map((frame, i) => {
        const isActive = i === currentIndex;
        const isDropTarget = dragOver === i && dragFromRef.current !== i;
        return (
          <div
            key={frame.id}
            data-story-thumb
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            className="flex-shrink-0 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing select-none"
            style={{ opacity: isDropTarget ? 0.4 : 1, transition: 'opacity 0.15s' }}
          >
            <button
              onClick={() => onSelect?.(i)}
              className={`rounded-md overflow-hidden relative transition-all duration-150 ${
                isActive
                  ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-neutral-950 scale-105'
                  : isDropTarget
                  ? 'ring-2 ring-violet-400/50'
                  : 'opacity-55 hover:opacity-90'
              }`}
              style={{
                width: THUMB_W, height: THUMB_H,
                border: isActive ? '1.5px solid rgb(139,92,246)' : '1.5px solid rgba(255,255,255,0.07)',
              }}
            >
              <div style={{
                width: FRAME_W, height: FRAME_H,
                transform: `scale(${SCALE})`,
                transformOrigin: 'top left',
                pointerEvents: 'none',
              }}>
                <StoryCanvas
                  frame={frame}
                  index={i}
                  totalFrames={frames.length}
                  theme={theme}
                  imageCache={imageCache}
                  coverOverride={coverOverride}
                  coverYouTubeId={coverYouTubeId}
                  coverMediaMode={coverMediaMode}
                />
              </div>
              {/* Frame type badge */}
              {frame.type && (
                <div className="absolute bottom-0.5 left-0.5 z-10 bg-black/70 rounded px-1 leading-none"
                  style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(167,139,250,0.85)', fontWeight: 700, paddingTop: 2, paddingBottom: 2 }}>
                  {TYPE_BADGE_MAP[frame.type] ?? frame.type.substring(0, 3).toUpperCase()}
                </div>
              )}
            </button>
            <span className={`text-[9px] font-mono leading-none transition-colors ${isActive ? 'text-violet-400' : 'text-white/20'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
