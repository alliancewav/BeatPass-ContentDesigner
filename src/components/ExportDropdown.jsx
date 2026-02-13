// ─── Export Dropdown Menu ───
// Context-aware: shows slide or story export options based on active editor tab.

import React from 'react';
import { Download, Package, Film, Headphones } from 'lucide-react';

export default function ExportDropdown({
  editorTab,
  currentSlide,
  isCurrentGif,
  isCurrentYt,
  onExportSingle,
  onExportAllZip,
  onExportAllPngs,
  onExportVideo,
  onExportVideoWithAudio,
  onExportStory,
  onExportAllStoriesZip,
  onExportPodcast,
  onExportPodcastThumbnail,
  hasPodcastAudio,
  onClose,
}) {
  const isStoryTab = editorTab === 'stories';
  const isPodcastTab = editorTab === 'podcast';

  // Close dropdown immediately, then fire async export
  const fire = (fn) => () => { onClose(); fn(); };

  if (isPodcastTab) {
    return (
      <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface-100 border border-border rounded-aspect shadow-2xl z-50 overflow-hidden">
        <button onClick={fire(onExportPodcast)} disabled={!hasPodcastAudio} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 disabled:opacity-30 disabled:cursor-not-allowed">
          <Headphones size={14} className="text-violet-400/70" />
          <div><div className="font-medium text-white/80">Export Podcast Video</div><div className="text-white/30 text-[10px]">{hasPodcastAudio ? '1920×1080 HD MP4 with audio' : 'Add audio file first'}</div></div>
        </button>
        <button onClick={fire(onExportPodcastThumbnail)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
          <Download size={14} className="text-white/40" />
          <div><div className="font-medium text-white/80">YouTube Thumbnail</div><div className="text-white/30 text-[10px]">1280×720 PNG</div></div>
        </button>
      </div>
    );
  }

  if (isStoryTab) {
    return (
      <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface-100 border border-border rounded-aspect shadow-2xl z-50 overflow-hidden">
        <button onClick={fire(onExportStory)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5">
          <Download size={14} className="text-white/40" />
          <div><div className="font-medium text-white/80">Current Story</div><div className="text-white/30 text-[10px]">Download as PNG</div></div>
        </button>
        <button onClick={fire(onExportAllStoriesZip)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
          <Package size={14} className="text-white/40" />
          <div><div className="font-medium text-white/80">All Stories (ZIP)</div><div className="text-white/30 text-[10px]">Bundle as .zip archive</div></div>
        </button>
      </div>
    );
  }

  // Slide export options
  const isGif = isCurrentGif(currentSlide);
  const isYt = isCurrentYt(currentSlide);
  const isVideoSlide = isYt || isGif;

  return (
    <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface-100 border border-border rounded-aspect shadow-2xl z-50 overflow-hidden">
      <button onClick={fire(onExportSingle)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5">
        {isVideoSlide ? <Film size={14} className="text-white/40" /> : <Download size={14} className="text-white/40" />}
        <div><div className="font-medium text-white/80">Current Slide</div><div className="text-white/30 text-[10px]">{isVideoSlide ? 'Download as MP4' : 'Download as PNG'}</div></div>
      </button>
      <button onClick={fire(onExportAllZip)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
        <Package size={14} className="text-white/40" />
        <div><div className="font-medium text-white/80">All Slides (ZIP)</div><div className="text-white/30 text-[10px]">Bundle as .zip archive</div></div>
      </button>
      <button onClick={fire(onExportAllPngs)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
        <Download size={14} className="text-white/40" />
        <div><div className="font-medium text-white/80">All Slides (PNGs)</div><div className="text-white/30 text-[10px]">Individual file downloads</div></div>
      </button>
      {isVideoSlide && (
        <button onClick={fire(onExportVideo)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
          <Film size={14} className="text-white/40" />
          <div><div className="font-medium text-white/80">Video (Muted)</div><div className="text-white/30 text-[10px]">{isGif ? 'Animated GIF → MP4' : '10s MP4, no audio'}</div></div>
        </button>
      )}
      {isYt && (
        <button onClick={fire(onExportVideoWithAudio)} className="w-full px-4 py-3 text-left text-xs hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 border-t border-white/[0.06]">
          <Film size={14} className="text-violet-400/70" />
          <div><div className="font-medium text-white/80">Video + Audio</div><div className="text-white/30 text-[10px]">60s MP4 with YouTube audio</div></div>
        </button>
      )}
    </div>
  );
}
