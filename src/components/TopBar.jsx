// ─── Top Bar ───
// Editor header with undo/redo, shortcuts, new, and export dropdown.

import React from 'react';
import {
  Undo2, Redo2, Keyboard, RotateCcw, Download, ChevronDown, Loader2, Menu, X,
} from 'lucide-react';
import ExportDropdown from './ExportDropdown';

export default function TopBar({
  imageCache,
  article,
  // Sidebar
  mobileSidebarOpen,
  setMobileSidebarOpen,
  // History
  undo,
  redo,
  canUndo,
  canRedo,
  // Shortcuts
  onOpenShortcuts,
  // Reset
  onReset,
  // Export
  exporting,
  exportMenuOpen,
  setExportMenuOpen,
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
}) {
  return (
    <div className="flex-none h-[50px] md:h-[58px] border-b border-border flex items-center justify-between px-2 md:px-4 z-30 bg-surface">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="md:hidden p-1.5 rounded-aspect-sm text-fg-secondary hover:text-fg-contrast hover:bg-surface-100 transition-all flex-shrink-0" title="Toggle panel">
          {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <img src={imageCache.favicon} className="w-5 h-5 md:w-6 md:h-6 rounded flex-shrink-0" alt="" />
        <span className="text-sm font-semibold text-white/70 hidden sm:inline">Content Designer</span>
        <span className="text-white/20 hidden md:inline">·</span>
        <span className="text-xs text-white/30 truncate max-w-[200px] hidden md:inline">{article?.title}</span>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        <button onClick={undo} className="p-1.5 rounded-aspect-sm text-fg-muted hover:text-fg-contrast hover:bg-surface-100 transition-all disabled:opacity-15 hidden sm:block" title="Undo (Ctrl+Z)" disabled={!canUndo}>
          <Undo2 size={15} />
        </button>
        <button onClick={redo} className="p-1.5 rounded-aspect-sm text-fg-muted hover:text-fg-contrast hover:bg-surface-100 transition-all disabled:opacity-15 hidden sm:block" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}>
          <Redo2 size={15} />
        </button>
        <button onClick={onOpenShortcuts} className="p-1.5 rounded-aspect-sm text-fg-muted hover:text-fg-contrast hover:bg-surface-100 transition-all hidden sm:block" title="Keyboard shortcuts">
          <Keyboard size={15} />
        </button>
        <div className="w-px h-5 bg-border mx-0.5 hidden sm:block" />
        <button onClick={onReset} className="px-2 md:px-3 py-1.5 text-xs font-medium text-fg-secondary hover:text-fg-contrast border border-border rounded-aspect-pill hover:bg-surface-100 transition-all flex items-center gap-1 md:gap-1.5">
          <RotateCcw size={13} /> <span className="hidden sm:inline">New</span>
        </button>
        <div className="relative">
          <button onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={exporting} className="px-2.5 md:px-4 py-1.5 text-xs font-semibold bg-white text-surface rounded-aspect-pill hover:bg-white/90 transition-all flex items-center gap-1 md:gap-1.5 disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span className="hidden sm:inline">Export</span> <ChevronDown size={12} />
          </button>
          {exportMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
              <ExportDropdown
                editorTab={editorTab}
                currentSlide={currentSlide}
                isCurrentGif={isCurrentGif}
                isCurrentYt={isCurrentYt}
                onExportSingle={onExportSingle}
                onExportAllZip={onExportAllZip}
                onExportAllPngs={onExportAllPngs}
                onExportVideo={onExportVideo}
                onExportVideoWithAudio={onExportVideoWithAudio}
                onExportStory={onExportStory}
                onExportAllStoriesZip={onExportAllStoriesZip}
                onExportPodcast={onExportPodcast}
                onExportPodcastThumbnail={onExportPodcastThumbnail}
                hasPodcastAudio={hasPodcastAudio}
                onClose={() => setExportMenuOpen(false)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
