// ─── Editor Sidebar ───
// Contains all 4 editor tabs: Slides, Stories, Caption, Twitter.

import React from 'react';
import {
  Plus, Trash2, Copy, RotateCw, Upload, ImagePlus, Video, ImageIcon,
  Layers, BookOpen, MessageSquare, Twitter, Minus, Type, Headphones, Music, FileAudio, X,
} from 'lucide-react';
import ThemePicker from './ThemePicker';
import { ICON_MAP, ICON_OPTIONS, CTA_ICON_OPTIONS } from './StoryCanvas';
import { DENSITY_PRESETS, LIMITS } from '../lib/layoutEngine';
import { normaliseYouTubeUrl } from '../lib/slideGenerator';
import { createBlankStory, generateStories } from '../lib/storyGenerator';
import { generateCaption } from '../lib/captionGenerator';
import { generateTweet, generateThread } from '../lib/tweetGenerator';
import CONFIG from '../config';

export default function EditorSidebar({
  // Tab state
  editorTab,
  setEditorTab,
  // Mobile
  mobileSidebarOpen,
  // Theme
  activeThemeId,
  setActiveThemeId,
  dynamicTheme,
  // Aspect ratio
  aspectRatio,
  setAspectRatio,
  // Slide numbers
  showSlideNumbers,
  setShowSlideNumbers,
  // Density
  density,
  article,
  slides,
  onRegenerate,
  // Cover image
  imageCache,
  coverOverride,
  coverInputUrl,
  coverYouTubeId,
  coverMediaMode,
  setCoverMediaMode,
  onCoverImageChange,
  onCoverFileUpload,
  onCoverReset,
  // Slides
  currentIndex,
  currentSlide,
  onUpdateSlideField,
  onAddSlideAfter,
  onDuplicateSlide,
  onDeleteSlide,
  // Stories
  storyFrames,
  setStoryFrames,
  currentStoryIndex,
  setCurrentStoryIndex,
  onUpdateStoryField,
  // Caption
  caption,
  setCaption,
  // Twitter
  tweetMode,
  setTweetMode,
  tweets,
  setTweets,
  threadTweets,
  setThreadTweets,
  // Utils
  copyToClipboard,
  // Podcast
  podcastMeta,
  setPodcastMeta,
  podcastAudioFile,
  setPodcastAudioFile,
  podcastAudioName,
  setPodcastAudioName,
  onExportPodcast,
  onExportPodcastThumbnail,
  exporting,
  podcastExporting,
}) {
  return (
    <div className={`
      fixed top-[50px] bottom-0 left-0 z-40 w-[85vw] max-w-[320px] transform transition-transform duration-300 ease-in-out
      md:relative md:top-auto md:bottom-auto md:inset-auto md:z-auto md:w-80 md:max-w-none md:transform-none
      flex-none border-r border-border flex flex-col bg-surface
      ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      {/* Tab bar */}
      <div className="flex-none flex border-b border-border bg-surface">
        {[
          { id: 'slides', icon: Layers, label: 'Slides' },
          { id: 'stories', icon: BookOpen, label: 'Stories' },
          { id: 'caption', icon: MessageSquare, label: 'Caption' },
          { id: 'twitter', icon: Twitter, label: 'X' },
          { id: 'podcast', icon: Headphones, label: 'Pod' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { setEditorTab(id); }}
            className={`flex-1 py-2 text-[9px] font-semibold flex flex-col items-center gap-1 transition-all relative ${
              editorTab === id ? 'text-white' : 'text-white/30 hover:text-white/55'
            }`}
          >
            {/* Active accent dot */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full transition-all ${
              editorTab === id ? 'bg-violet-500 opacity-100 shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'opacity-0'
            }`} />
            <Icon size={13} className={editorTab === id ? 'text-violet-400' : ''} />
            <span className="tracking-wide">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
        {/* ── Slides Tab ── */}
        {editorTab === 'slides' && (
          <>
            <div className="p-4 space-y-5 border-b border-border">
              <ThemePicker activeThemeId={activeThemeId} onThemeChange={setActiveThemeId} dynamicPreview={dynamicTheme} />
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Aspect Ratio</label>
                <div className="flex bg-surface-100/50 p-1 rounded-aspect-sm">
                  <button onClick={() => setAspectRatio('square')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${aspectRatio === 'square' ? 'bg-surface-200 text-fg-contrast' : 'text-fg-muted hover:text-fg-secondary'}`}>1:1</button>
                  <button onClick={() => setAspectRatio('portrait')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${aspectRatio === 'portrait' ? 'bg-surface-200 text-fg-contrast' : 'text-fg-muted hover:text-fg-secondary'}`}>4:5</button>
                </div>
              </div>
              {/* Slide number watermark toggle */}
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Slide Numbers</label>
                <button
                  onClick={() => setShowSlideNumbers(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${showSlideNumbers ? 'bg-accent/60' : 'bg-surface-100'}`}
                  title={showSlideNumbers ? 'Hide slide number watermarks' : 'Show slide number watermarks'}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${showSlideNumbers ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {/* Density selector + Regenerate */}
              {article && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Carousel Density</label>
                  <div className="flex bg-surface-100/50 p-0.5 rounded-aspect-sm">
                    {Object.entries(DENSITY_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => onRegenerate(key)}
                        className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all capitalize ${
                          density === key ? 'bg-surface-200 text-fg-contrast' : 'text-fg-muted hover:text-fg-secondary'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-white/20 text-center">
                    {DENSITY_PRESETS[density]?.label} · {slides.filter(s => s.type === 'content').length} content slides
                  </div>
                </div>
              )}
              {/* Cover Image Swap */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Cover Image</label>
                {imageCache.cover && (
                  <div className="rounded-aspect-sm overflow-hidden border border-border" style={{ height: 56 }}>
                    <img src={imageCache.cover} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <input
                  type="text"
                  value={coverInputUrl}
                  onChange={(e) => onCoverImageChange(e.target.value)}
                  placeholder="Image or YouTube URL to override..."
                  className="w-full px-3 py-2 bg-surface-100/50 border border-border rounded-aspect-sm text-xs text-fg-contrast outline-none focus:border-border-hover transition-colors placeholder:text-fg-muted"
                />
                {/* YouTube detected — show video/thumbnail toggle */}
                {coverYouTubeId && (
                  <div className="flex bg-surface-100/50 p-0.5 rounded-aspect-sm">
                    <button onClick={() => setCoverMediaMode('thumbnail')} className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${coverMediaMode === 'thumbnail' ? 'bg-surface-200 text-fg-contrast' : 'text-fg-muted hover:text-fg-secondary'}`}>
                      <ImageIcon size={11} /> Thumbnail
                    </button>
                    <button onClick={() => setCoverMediaMode('video')} className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${coverMediaMode === 'video' ? 'bg-surface-200 text-fg-contrast' : 'text-fg-muted hover:text-fg-secondary'}`}>
                      <Video size={11} /> Video Autoplay
                    </button>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-fg-muted hover:text-fg-secondary bg-surface-100/50 border border-border rounded-aspect-sm cursor-pointer hover:bg-surface-100 transition-all">
                    <Upload size={12} /> Upload File
                    <input type="file" accept="image/*" onChange={onCoverFileUpload} className="hidden" />
                  </label>
                  {coverOverride && article?.featureImage && (
                    <button
                      onClick={onCoverReset}
                      className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-fg-muted hover:text-fg-secondary bg-surface-100/50 border border-border rounded-aspect-sm hover:bg-surface-100 transition-all"
                    >
                      <RotateCw size={11} /> Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30 flex-shrink-0">Slide {currentIndex + 1} of {slides.length}</span>
                  {currentSlide && (currentSlide.subtype || currentSlide.type !== 'content' || currentSlide.isContinuation) && (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-violet-400/25 text-violet-400/70 leading-none flex-shrink-0">
                      {currentSlide.type === 'cover' ? 'COVER' : currentSlide.type === 'cta' ? 'CTA' : currentSlide.subtype ? currentSlide.subtype.toUpperCase() : currentSlide.isContinuation ? 'CONT' : ''}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={onAddSlideAfter} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Add slide after"><Plus size={14} /></button>
                  <button onClick={onDuplicateSlide} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Duplicate slide"><Copy size={14} /></button>
                  <button onClick={onDeleteSlide} disabled={slides.length <= 2} className="p-1.5 rounded-md hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-20" title="Delete slide"><Trash2 size={14} /></button>
                </div>
              </div>
              {currentSlide && (
                <div className="space-y-3">
                  {/* Slide type selector */}
                  {!currentSlide.subtype && !currentSlide.isContinuation && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Slide Type</label>
                      <div className="flex bg-white/[0.04] p-1 rounded-lg">
                        {['cover', 'content', 'cta'].map(t => (
                          <button key={t} onClick={() => onUpdateSlideField(currentSlide.id, 'type', t)}
                            className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all capitalize ${currentSlide.type === t ? 'bg-white/[0.12] text-white' : 'text-white/35 hover:text-white/55'}`}>
                            {t === 'cta' ? 'CTA' : t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Title</span>
                      {currentSlide.type === 'content' && (() => {
                        const tLen = (currentSlide.title || '').length;
                        const over = tLen > LIMITS.maxTitleLen;
                        return <span className={`text-[9px] normal-case font-mono ${over ? 'text-amber-400/80' : 'text-white/20'}`}>{tLen}/{LIMITS.maxTitleLen}{over ? ' ⚠' : ''}</span>;
                      })()}
                    </label>
                    <input type="text" value={currentSlide.title || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'title', e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                  </div>
                  {currentSlide.type === 'content' && (
                    <>
                      {/* H3 sub-heading label — always editable for content slides */}
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Sub-heading <span className="text-white/15 normal-case">(shown in accent colour above body)</span></label>
                        <input type="text" value={currentSlide.subHeadingLabel || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'subHeadingLabel', e.target.value || undefined)} placeholder="Optional label..." className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Content</label>
                        <textarea value={currentSlide.content || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'content', e.target.value)} rows={3} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1">
                            <Type size={10} className="text-white/20" />
                            <span className="text-[9px] text-white/20 uppercase tracking-wider">Font</span>
                            <button
                              onClick={() => onUpdateSlideField(currentSlide.id, 'fontSizeOverride', Math.max(-12, (currentSlide.fontSizeOverride || 0) - 2))}
                              className="w-5 h-5 flex items-center justify-center rounded bg-surface-100/50 text-fg-muted hover:text-fg-contrast hover:bg-surface-200 transition-colors"
                              title="Decrease font size"
                            ><Minus size={10} /></button>
                            <span className="text-[10px] text-fg-secondary w-7 text-center font-mono">{(currentSlide.fontSizeOverride || 0) > 0 ? '+' : ''}{currentSlide.fontSizeOverride || 0}</span>
                            <button
                              onClick={() => onUpdateSlideField(currentSlide.id, 'fontSizeOverride', Math.min(12, (currentSlide.fontSizeOverride || 0) + 2))}
                              className="w-5 h-5 flex items-center justify-center rounded bg-surface-100/50 text-fg-muted hover:text-fg-contrast hover:bg-surface-200 transition-colors"
                              title="Increase font size"
                            ><Plus size={10} /></button>
                            {(currentSlide.fontSizeOverride || 0) !== 0 && (
                              <button
                                onClick={() => onUpdateSlideField(currentSlide.id, 'fontSizeOverride', 0)}
                                className="text-[9px] text-fg-muted hover:text-fg-secondary transition-colors ml-0.5"
                                title="Reset font size"
                              >Reset</button>
                            )}
                          </div>
                          <span className="text-[10px] text-white/20">{(currentSlide.content || '').length} / {LIMITS.contentCharLimit}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Bullets{currentSlide.bullets && currentSlide.bullets.length > 0 ? ` (${currentSlide.bullets.length})` : ''}</span>
                          <button
                            onClick={() => {
                              const prev = currentSlide.bullets || [];
                              onUpdateSlideField(currentSlide.id, 'bullets', [...prev, 'New bullet point']);
                            }}
                            className="text-white/30 hover:text-white/60 transition-colors"
                            title="Add bullet"
                          ><Plus size={12} /></button>
                        </label>
                        {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                          <div className="space-y-1.5">
                            {currentSlide.bullets.map((b, bi) => (
                              <div key={bi} className="flex gap-1">
                                <input
                                  type="text"
                                  value={b}
                                  onChange={(e) => {
                                    const updated = [...currentSlide.bullets];
                                    updated[bi] = e.target.value;
                                    onUpdateSlideField(currentSlide.id, 'bullets', updated);
                                  }}
                                  className="flex-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors"
                                />
                                <button
                                  onClick={() => {
                                    const updated = currentSlide.bullets.filter((_, j) => j !== bi);
                                    onUpdateSlideField(currentSlide.id, 'bullets', updated.length > 0 ? updated : null);
                                  }}
                                  className="px-1.5 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                                  title="Remove bullet"
                                ><Trash2 size={11} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center gap-2">
                          Image Slide
                          <button
                            onClick={() => onUpdateSlideField(currentSlide.id, 'imageSlide', !currentSlide.imageSlide)}
                            className={`w-8 h-4 rounded-full transition-colors ${currentSlide.imageSlide ? 'bg-violet-500' : 'bg-white/10'}`}
                          >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${currentSlide.imageSlide ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </label>
                        {currentSlide.imageSlide && (
                          <>
                            <input type="text" value={currentSlide.image || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'image', e.target.value || null)} placeholder="Image URL (full-bleed bg)" className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                            {currentSlide.image && (
                              <div className="mt-1.5 rounded-md overflow-hidden border border-white/[0.06]" style={{ height: 48 }}>
                                <img src={currentSlide.image} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="mt-2">
                              <label className="text-[10px] font-medium text-white/20 uppercase tracking-wider mb-1 flex items-center justify-between">
                                <span>Image Focus (vertical)</span>
                                <span className="text-white/15 normal-case">{Math.round((currentSlide.parallaxPosition ?? 0.5) * 100)}%</span>
                              </label>
                              <input type="range" min="0" max="100" step="1"
                                value={Math.round((currentSlide.parallaxPosition ?? 0.5) * 100)}
                                onChange={(e) => onUpdateSlideField(currentSlide.id, 'parallaxPosition', parseInt(e.target.value) / 100)}
                                className="w-full accent-violet-500 cursor-pointer" style={{ height: 4 }} />
                              <div className="flex justify-between mt-0.5">
                                <span className="text-[9px] text-white/15">Top</span>
                                <span className="text-[9px] text-white/15">Bottom</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Video URL <span className="text-white/15 normal-case">(YouTube or mp4)</span></label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={currentSlide.videoUrl || ''}
                            onChange={(e) => {
                              const raw = e.target.value || null;
                              if (raw) {
                                const norm = normaliseYouTubeUrl(raw);
                                const ytMatch = norm.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                                if (ytMatch) {
                                  onUpdateSlideField(currentSlide.id, {
                                    videoUrl: norm,
                                    image: `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`,
                                    imageSlide: true,
                                  });
                                } else {
                                  onUpdateSlideField(currentSlide.id, 'videoUrl', norm);
                                }
                              } else {
                                onUpdateSlideField(currentSlide.id, 'videoUrl', null);
                              }
                            }}
                            placeholder="https://youtu.be/... or https://...video.mp4"
                            className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15"
                          />
                          {currentSlide.videoUrl && (
                            <button onClick={() => {
                              const img = currentSlide.image || '';
                              const isYtThumb = /img\.youtube\.com\/vi\/|i\.ytimg\.com\/vi\//.test(img);
                              onUpdateSlideField(currentSlide.id, {
                                videoUrl: null,
                                ...(isYtThumb ? { imageSlide: false, image: null } : {}),
                              });
                            }} className="px-2 py-1 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Remove video">✕</button>
                          )}
                        </div>
                        {currentSlide.videoUrl && /youtube|youtu\.be/i.test(currentSlide.videoUrl) && (
                          <div className="text-[10px] text-violet-400/60 mt-1">YouTube video detected — thumbnail auto-set</div>
                        )}
                      </div>
                    </>
                  )}
                  {/* Image slide caption */}
                  {currentSlide.imageSlide && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Image Caption <span className="text-white/15 normal-case">(italic label shown below body text)</span></label>
                      <input type="text" value={currentSlide.imageCaption || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'imageCaption', e.target.value || null)} placeholder="Optional caption..." className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                    </div>
                  )}
                  {/* Code slide fields */}
                  {currentSlide.subtype === 'code' && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Caption <span className="text-white/15 normal-case">(context shown above the code block)</span></label>
                      <input type="text" value={currentSlide.codeCaption || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'codeCaption', e.target.value)} placeholder="Briefly describe this code..." className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                    </div>
                  )}
                  {/* Callout fields */}
                  {currentSlide.subtype === 'callout' && (
                    <>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Style</label>
                        <div className="flex bg-white/[0.04] p-1 rounded-lg">
                          <button onClick={() => onUpdateSlideField(currentSlide.id, 'calloutIsQuote', false)}
                            className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all ${!currentSlide.calloutIsQuote ? 'bg-white/[0.12] text-white' : 'text-white/35 hover:text-white/55'}`}>
                            Callout (emoji)
                          </button>
                          <button onClick={() => onUpdateSlideField(currentSlide.id, 'calloutIsQuote', true)}
                            className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all ${currentSlide.calloutIsQuote ? 'bg-white/[0.12] text-white' : 'text-white/35 hover:text-white/55'}`}>
                            Pull Quote
                          </button>
                        </div>
                      </div>
                      {!currentSlide.calloutIsQuote && (
                        <div>
                          <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Callout Emoji <span className="text-white/15 normal-case">(optional)</span></label>
                          <input type="text" value={currentSlide.calloutEmoji || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'calloutEmoji', e.target.value)} placeholder="e.g. 💡" className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Callout Text</label>
                        <textarea value={currentSlide.calloutText || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'calloutText', e.target.value)} rows={3} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                      </div>
                    </>
                  )}
                  {currentSlide.type === 'cta' && (
                    <>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">CTA Heading <span className="text-white/15 normal-case">(Enter for line break)</span></label>
                        <textarea rows={2} value={currentSlide.ctaHeading ?? ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'ctaHeading', e.target.value)} placeholder="Read Full&#10;Article" className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">CTA Label</label>
                        <input type="text" value={currentSlide.ctaLabel ?? ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'ctaLabel', e.target.value)} placeholder="Link in Bio" className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                      </div>
                    </>
                  )}
                  {(currentSlide.type === 'cover' || currentSlide.type === 'cta') && currentSlide.subtitle !== undefined && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Subtitle / Tag</label>
                      <input type="text" value={currentSlide.subtitle || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'subtitle', e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                    </div>
                  )}
                  {currentSlide.type === 'cover' && (
                    <>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Reading Time</label>
                        <input type="text" value={currentSlide.readingTime || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'readingTime', e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Author <span className="text-white/15 normal-case">(shown below reading time)</span></label>
                        <input type="text" value={currentSlide.primaryAuthor || ''} onChange={(e) => onUpdateSlideField(currentSlide.id, 'primaryAuthor', e.target.value || null)} placeholder="Author name..." className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Stories Tab ── */}
        {editorTab === 'stories' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
                Story {currentStoryIndex + 1} of {storyFrames.length}
              </span>
              {article && (
                <button
                  onClick={() => {
                    const fresh = generateStories(article, slides);
                    setStoryFrames(fresh);
                    setCurrentStoryIndex(0);
                  }}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
                  title="Regenerate all story frames from article"
                ><RotateCw size={12} /></button>
              )}
              <div className="flex gap-0.5">
                {/* Move left */}
                <button
                  onClick={() => {
                    if (currentStoryIndex <= 0) return;
                    const nf = [...storyFrames];
                    [nf[currentStoryIndex - 1], nf[currentStoryIndex]] = [nf[currentStoryIndex], nf[currentStoryIndex - 1]];
                    setStoryFrames(nf);
                    setCurrentStoryIndex(currentStoryIndex - 1);
                  }}
                  disabled={currentStoryIndex <= 0}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors disabled:opacity-20" title="Move left"
                ><span className="text-[10px]">◀</span></button>
                {/* Move right */}
                <button
                  onClick={() => {
                    if (currentStoryIndex >= storyFrames.length - 1) return;
                    const nf = [...storyFrames];
                    [nf[currentStoryIndex], nf[currentStoryIndex + 1]] = [nf[currentStoryIndex + 1], nf[currentStoryIndex]];
                    setStoryFrames(nf);
                    setCurrentStoryIndex(currentStoryIndex + 1);
                  }}
                  disabled={currentStoryIndex >= storyFrames.length - 1}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors disabled:opacity-20" title="Move right"
                ><span className="text-[10px]">▶</span></button>
                <div className="w-px h-4 bg-white/[0.08] mx-0.5 self-center" />
                {/* Add */}
                <button
                  onClick={() => {
                    const curType = storyFrames[currentStoryIndex]?.type || 'hook';
                    const ns = createBlankStory(curType);
                    const nf = [...storyFrames];
                    nf.splice(currentStoryIndex + 1, 0, ns);
                    setStoryFrames(nf);
                    setCurrentStoryIndex(currentStoryIndex + 1);
                  }}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Add story frame"
                ><Plus size={14} /></button>
                {/* Duplicate */}
                <button
                  onClick={() => {
                    const src = storyFrames[currentStoryIndex];
                    const dupe = { ...src, id: `story-dup-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` };
                    if (dupe.pollOptions) dupe.pollOptions = [...dupe.pollOptions];
                    const nf = [...storyFrames];
                    nf.splice(currentStoryIndex + 1, 0, dupe);
                    setStoryFrames(nf);
                    setCurrentStoryIndex(currentStoryIndex + 1);
                  }}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Duplicate story frame"
                ><Copy size={14} /></button>
                {/* Delete */}
                <button
                  onClick={() => {
                    if (storyFrames.length <= 1) return;
                    const nf = storyFrames.filter((_, i) => i !== currentStoryIndex);
                    setStoryFrames(nf);
                    setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
                  }}
                  disabled={storyFrames.length <= 1}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-20" title="Delete story frame"
                ><Trash2 size={14} /></button>
              </div>
            </div>
            {storyFrames[currentStoryIndex] && (() => {
              const sf = storyFrames[currentStoryIndex];
              const sfType = sf.type;
              return (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Type</label>
                    <div className="grid grid-cols-3 gap-1 bg-white/[0.04] p-1 rounded-lg">
                      {['hook', 'teaser', 'tip', 'quote', 'poll', 'cta'].map(t => (
                        <button key={t} onClick={() => onUpdateStoryField('type', t)} className={`py-1.5 text-[10px] font-semibold rounded-md transition-all capitalize ${sfType === t ? 'bg-white/[0.12] text-white' : 'text-white/40 hover:text-white/60'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">{sfType === 'quote' ? 'Quote Text' : 'Headline'}</label>
                    <textarea value={sf.headline || ''} onChange={(e) => onUpdateStoryField('headline', e.target.value)} rows={sfType === 'quote' ? 3 : 2} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">{sfType === 'quote' ? 'Attribution' : 'Subtext'}</label>
                    <textarea value={sf.subtext || ''} onChange={(e) => onUpdateStoryField('subtext', e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
                  </div>
                  {/* Teaser-specific: bullet points */}
                  {sfType === 'teaser' && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Bullets <span className="text-white/15 normal-case">(replaces subtext when present)</span></span>
                        <button onClick={() => onUpdateStoryField('bullets', [...(sf.bullets || []), 'Key point'])} className="text-white/30 hover:text-white/60 transition-colors" title="Add bullet"><Plus size={12} /></button>
                      </label>
                      {sf.bullets && sf.bullets.length > 0 && (
                        <div className="space-y-1.5">
                          {sf.bullets.map((b, bi) => (
                            <div key={bi} className="flex gap-1">
                              <input type="text" value={b} onChange={(e) => {
                                const updated = [...sf.bullets]; updated[bi] = e.target.value;
                                onUpdateStoryField('bullets', updated);
                              }} className="flex-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors" />
                              <button onClick={() => {
                                const updated = sf.bullets.filter((_, j) => j !== bi);
                                onUpdateStoryField('bullets', updated.length > 0 ? updated : null);
                              }} className="px-1.5 text-white/20 hover:text-red-400 transition-colors flex-shrink-0" title="Remove"><Trash2 size={11} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Icon picker */}
                  <div>
                    <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1.5 block">Icon</label>
                    <div className="grid grid-cols-7 gap-1">
                      {ICON_OPTIONS.map((name) => {
                        const IconComp = ICON_MAP[name];
                        const isActive = (sf.icon || 'flame') === name;
                        return (
                          <button
                            key={name}
                            onClick={() => onUpdateStoryField('icon', name)}
                            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                              isActive ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]'
                            }`}
                            title={name}
                          >
                            <IconComp size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Hook-specific: Swipe hint */}
                  {sfType === 'hook' && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Swipe Hint <span className="text-white/15 normal-case">(clear to hide)</span></label>
                      <input type="text" value={sf.swipeHint ?? 'Swipe for more'} onChange={(e) => onUpdateStoryField('swipeHint', e.target.value)} placeholder="Swipe for more" className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                    </div>
                  )}
                  {/* Poll options */}
                  {sfType === 'poll' && (() => {
                    const opts = sf.pollOptions && sf.pollOptions.length > 0 ? sf.pollOptions : ['Yes', 'No'];
                    return (
                      <div>
                        <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Poll Options ({opts.length})</span>
                          <button
                            onClick={() => onUpdateStoryField('pollOptions', [...opts, `Option ${opts.length + 1}`])}
                            className="text-white/30 hover:text-white/60 transition-colors"
                            title="Add option"
                          ><Plus size={12} /></button>
                        </label>
                        {opts.map((opt, oi) => (
                          <div key={oi} className="flex gap-1 mb-1">
                            <input type="text" value={opt} onChange={(e) => {
                              const newOpts = [...opts];
                              newOpts[oi] = e.target.value;
                              onUpdateStoryField('pollOptions', newOpts);
                            }} className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors" />
                            {opts.length > 2 && (
                              <button
                                onClick={() => onUpdateStoryField('pollOptions', opts.filter((_, j) => j !== oi))}
                                className="px-1.5 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                                title="Remove option"
                              ><Trash2 size={11} /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {/* Tip label — for tip type */}
                  {sfType === 'tip' && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Tip Label <span className="text-white/15 normal-case">(shown above headline)</span></label>
                      <input type="text" value={sf.tipLabel ?? 'Pro Tip'} onChange={(e) => onUpdateStoryField('tipLabel', e.target.value)} placeholder="Pro Tip" className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                    </div>
                  )}
                  {/* Quote source — for quote type */}
                  {sfType === 'quote' && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Source <span className="text-white/15 normal-case">(attribution shown below quote)</span></label>
                      <input type="text" value={sf.subtext || ''} onChange={(e) => onUpdateStoryField('subtext', e.target.value)} placeholder="— Author Name" className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                    </div>
                  )}
                  {/* CTA Label — for teaser and cta types */}
                  {(sfType === 'teaser' || sfType === 'cta') && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">CTA Label</label>
                      <input type="text" value={sf.ctaLabel || ''} onChange={(e) => onUpdateStoryField('ctaLabel', e.target.value)} placeholder="Swipe up · See carousel" className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                    </div>
                  )}
                  {/* CTA Icon picker — for teaser and cta types */}
                  {(sfType === 'teaser' || sfType === 'cta') && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1.5 block">CTA Icon</label>
                      <div className="grid grid-cols-7 gap-1">
                        {CTA_ICON_OPTIONS.map((name) => {
                          const IconComp = ICON_MAP[name];
                          if (!IconComp) return null;
                          const isActive = (sf.ctaIcon || 'arrowRight') === name;
                          return (
                            <button
                              key={name}
                              onClick={() => onUpdateStoryField('ctaIcon', name)}
                              className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                                isActive ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]'
                              }`}
                              title={name}
                            >
                              <IconComp size={14} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Domain — for cta type */}
                  {sfType === 'cta' && (
                    <div>
                      <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Domain <span className="text-white/15 normal-case">(clear to hide)</span></label>
                      <input type="text" value={sf.domain ?? CONFIG.brand.domain} onChange={(e) => onUpdateStoryField('domain', e.target.value)} placeholder={CONFIG.brand.domain} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15" />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Caption Tab ── */}
        {editorTab === 'caption' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Instagram Caption</span>
              <div className="flex gap-1">
                {article && (
                  <button onClick={() => setCaption(generateCaption(article, slides))} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Regenerate"><RotateCw size={13} /></button>
                )}
                <button onClick={() => copyToClipboard(`${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${caption.hashtags}`)} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Copy all"><Copy size={13} /></button>
              </div>
            </div>
            {[['hook', 'Hook Line', 2], ['body', 'Body', 5], ['cta', 'CTA', 2]].map(([field, label, rows]) => (
              <div key={field}>
                <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>{label}</span>
                  <button onClick={() => copyToClipboard(caption[field])} className="text-white/25 hover:text-white/60 transition-colors" title={`Copy ${label}`}><Copy size={11} /></button>
                </label>
                <textarea value={caption[field]} onChange={(e) => setCaption(p => ({ ...p, [field]: e.target.value }))} rows={rows} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none" />
              </div>
            ))}
            <div>
              <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Hashtags</span>
                <button onClick={() => copyToClipboard(caption.hashtags)} className="text-white/30 hover:text-white/60 transition-colors" title="Copy hashtags"><Copy size={11} /></button>
              </label>
              <textarea value={caption.hashtags} onChange={(e) => setCaption(p => ({ ...p, hashtags: e.target.value }))} rows={3} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 outline-none focus:border-white/20 transition-colors resize-none" />
            </div>
            {(() => {
              const totalLen = `${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${caption.hashtags}`.length;
              const pct = Math.min(100, (totalLen / 2200) * 100);
              const colorClass = totalLen > 2200 ? 'text-red-400' : totalLen > 1800 ? 'text-yellow-400/70' : 'text-white/20';
              return (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] ${colorClass}`}>{totalLen.toLocaleString()} / 2,200 chars</span>
                    <span className="text-[9px] text-white/15">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: totalLen > 2200 ? '#f87171' : totalLen > 1800 ? '#facc15' : 'rgba(139,92,246,0.7)' }} />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Twitter Tab ── */}
        {editorTab === 'twitter' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Twitter / X</span>
              <div className="flex gap-1">
                {article && (
                  <button onClick={() => {
                    if (tweetMode === 'single') { const t = generateTweet(article); setTweets(t); }
                    else { const t = generateThread(article, slides); setThreadTweets(t); }
                  }} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Regenerate"><RotateCw size={13} /></button>
                )}
                <button onClick={() => { const active = tweetMode === 'single' ? tweets : threadTweets; copyToClipboard(active.map(t => typeof t === 'string' ? t : t.text).join('\n\n---\n\n')); }} className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors" title="Copy all"><Copy size={13} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Mode</label>
              <div className="flex bg-white/[0.04] p-1 rounded-lg">
                <button onClick={() => { setTweetMode('single'); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tweetMode === 'single' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>Single</button>
                <button onClick={() => { setTweetMode('thread'); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${tweetMode === 'thread' ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/60'}`}>Thread</button>
              </div>
            </div>
            {(tweetMode === 'single' ? tweets : threadTweets).map((tw, i) => {
              const text = typeof tw === 'string' ? tw : tw.text;
              const setter = tweetMode === 'single' ? setTweets : setThreadTweets;
              return (
                <div key={i} className="space-y-1">
                  {tweetMode === 'thread' && <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider">Tweet {i + 1} / {threadTweets.length}</label>}
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setter(prev => prev.map((t, j) => j === i ? (typeof t === 'string' ? e.target.value : { ...t, text: e.target.value }) : t));
                    }}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white outline-none focus:border-white/20 transition-colors resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] ${text.length > 280 ? 'text-red-400' : text.length > 260 ? 'text-yellow-400/70' : 'text-white/20'}`}>
                      {text.length} / 280
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyToClipboard(text)} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">Copy</button>
                      {tweetMode === 'thread' && threadTweets.length > 1 && (
                        <button onClick={() => { setter(prev => prev.filter((_, j) => j !== i)); }} className="text-[10px] text-white/20 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {tweetMode === 'thread' && (
              <button
                onClick={() => setThreadTweets(prev => [...prev, ''])}
                className="w-full py-2 text-xs text-white/30 hover:text-white/60 border border-dashed border-white/[0.08] rounded-lg hover:bg-white/[0.02] transition-all flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Add Tweet
              </button>
            )}
          </div>
        )}

        {/* ── Podcast Tab ── */}
        {editorTab === 'podcast' && (
          <div className="p-4 space-y-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Podcast Video</span>

            {/* Audio File Drop Zone */}
            <div>
              <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1.5 block">Audio File</label>
              {podcastAudioFile ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg">
                  <FileAudio size={16} className="text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{podcastAudioName}</div>
                    <div className="text-[10px] text-white/30">
                      {(podcastAudioFile.size / (1024 * 1024)).toFixed(1)} MB
                      {podcastMeta.audioDuration > 0 && ` · ${Math.floor(podcastMeta.audioDuration / 60)}:${String(Math.floor(podcastMeta.audioDuration % 60)).padStart(2, '0')}`}
                    </div>
                  </div>
                  <button
                    onClick={() => { setPodcastAudioFile(null); setPodcastAudioName(''); setPodcastMeta(prev => ({ ...prev, audioDuration: 0 })); }}
                    className="p-1 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Remove audio"
                  ><X size={14} /></button>
                </div>
              ) : (
                <div
                  className="relative border-2 border-dashed border-white/[0.1] rounded-lg hover:border-violet-500/40 transition-all cursor-pointer group"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-violet-500/60', 'bg-violet-500/5'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('border-violet-500/60', 'bg-violet-500/5'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-violet-500/60', 'bg-violet-500/5');
                    const file = e.dataTransfer.files[0];
                    if (file && /\.(mp3|wav|m4a|ogg|aac)$/i.test(file.name)) {
                      handlePodcastAudioFile(file, setPodcastAudioFile, setPodcastAudioName, setPodcastMeta);
                    }
                  }}
                >
                  <label className="flex flex-col items-center justify-center py-6 cursor-pointer">
                    <Music size={24} className="text-white/20 group-hover:text-violet-400/60 transition-colors mb-2" />
                    <span className="text-[11px] text-white/30 group-hover:text-white/50 transition-colors">Drop audio or click to upload</span>
                    <span className="text-[9px] text-white/15 mt-1">.mp3, .wav, .m4a</span>
                    <input
                      type="file"
                      accept=".mp3,.wav,.m4a,.ogg,.aac,audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePodcastAudioFile(file, setPodcastAudioFile, setPodcastAudioName, setPodcastMeta);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Podcast Title */}
            <div>
              <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Podcast Title</label>
              <input
                type="text"
                value={podcastMeta.title || ''}
                onChange={(e) => setPodcastMeta(prev => ({ ...prev, title: e.target.value }))}
                placeholder="BeatPass Podcast"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15"
              />
            </div>

            {/* Episode Number */}
            <div>
              <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Episode Number</label>
              <input
                type="number"
                min="1"
                value={podcastMeta.episodeNumber || 1}
                onChange={(e) => setPodcastMeta(prev => ({ ...prev, episodeNumber: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {/* Episode Subtitle */}
            <div>
              <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Episode Subtitle</label>
              <textarea
                value={podcastMeta.subtitle || ''}
                onChange={(e) => setPodcastMeta(prev => ({ ...prev, subtitle: e.target.value }))}
                rows={2}
                placeholder="Episode topic or article title..."
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors resize-none placeholder:text-white/15"
              />
            </div>

            {/* Guest / Host Name */}
            <div>
              <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Guest / Host</label>
              <input
                type="text"
                value={podcastMeta.guestName || ''}
                onChange={(e) => setPodcastMeta(prev => ({ ...prev, guestName: e.target.value }))}
                placeholder="Host or guest name..."
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15"
              />
            </div>

            {/* Cover Image Override */}
            <div>
              <label className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-1 block">Cover Art <span className="text-white/15 normal-case">(1:1 square)</span></label>
              {podcastMeta.coverImage && (
                <div className="rounded-lg overflow-hidden border border-white/[0.06] mb-1.5" style={{ width: 80, height: 80 }}>
                  <img src={podcastMeta.coverImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <input
                type="text"
                value={podcastMeta.coverImage || ''}
                onChange={(e) => setPodcastMeta(prev => ({ ...prev, coverImage: e.target.value || null }))}
                placeholder="Image URL or leave blank for article cover..."
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white outline-none focus:border-white/20 transition-colors placeholder:text-white/15"
              />
            </div>

            {/* Export info + button */}
            <div className="pt-3 border-t border-white/[0.06] space-y-3">
              <div className="text-[10px] text-white/20 space-y-1">
                <div>Output: 1920×1080 HD MP4</div>
                {podcastMeta.audioDuration > 0 && (
                  <div>Duration: {Math.floor(podcastMeta.audioDuration / 60)}:{String(Math.floor(podcastMeta.audioDuration % 60)).padStart(2, '0')}</div>
                )}
                <div>Estimated render: {podcastMeta.audioDuration > 0 ? `~${Math.max(1, Math.ceil(podcastMeta.audioDuration / 300))}–${Math.max(2, Math.ceil(podcastMeta.audioDuration / 180))} min` : '—'}</div>
              </div>
              <button
                onClick={onExportPodcast}
                disabled={!podcastAudioFile || podcastExporting}
                className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-500 text-white"
              >
                <Headphones size={14} />
                {podcastExporting ? 'Exporting...' : 'Export Podcast Video'}
              </button>
              <button
                onClick={onExportPodcastThumbnail}
                disabled={exporting}
                className="w-full py-2 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06]"
              >
                <ImageIcon size={13} />
                YouTube Thumbnail
                <span className="text-white/25 text-[10px] ml-auto">1280×720</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper: handle podcast audio file selection ──
function handlePodcastAudioFile(file, setPodcastAudioFile, setPodcastAudioName, setPodcastMeta) {
  setPodcastAudioFile(file);
  setPodcastAudioName(file.name);
  // Read audio duration
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.onloadedmetadata = () => {
    if (isFinite(audio.duration) && audio.duration > 0) {
      setPodcastMeta(prev => ({ ...prev, audioDuration: audio.duration }));
    }
    URL.revokeObjectURL(url);
  };
  audio.onerror = () => URL.revokeObjectURL(url);
  audio.src = url;

  // Extract real waveform peaks using Web Audio API
  extractWaveformPeaks(file).then(peaks => {
    if (peaks && peaks.length > 0) {
      setPodcastMeta(prev => ({ ...prev, waveformPeaks: peaks }));
    }
  }).catch(err => console.warn('Waveform extraction failed:', err));
}

// ── Extract waveform peaks from audio file using Web Audio API ──
async function extractWaveformPeaks(file, targetPeaks = 600) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0); // mono or left channel
    const samplesPerPeak = Math.floor(channelData.length / targetPeaks);
    const peaks = [];
    for (let i = 0; i < targetPeaks; i++) {
      let max = 0;
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channelData.length);
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }
    // Normalize peaks to 0–1 range
    const peakMax = Math.max(...peaks, 0.001);
    return peaks.map(p => p / peakMax);
  } finally {
    audioCtx.close();
  }
}
