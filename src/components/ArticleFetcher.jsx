import React, { useState, useEffect } from 'react';
import { Link, ArrowRight, AlertCircle, Loader2, PenLine, Zap, Scale, BookOpen, X } from 'lucide-react';
import { fetchPostByUrl, parsePostToArticle } from '../lib/ghostApi';
import { generateSlides } from '../lib/slideGenerator';
import CONFIG from '../config';

const DENSITY_OPTIONS = [
  { id: 'concise',  icon: Zap,      label: 'Concise',  desc: '3–5 slides' },
  { id: 'balanced', icon: Scale,     label: 'Balanced', desc: '6–12 slides' },
  { id: 'detailed', icon: BookOpen,  label: 'Detailed', desc: '9–16 slides' },
];

export default function ArticleFetcher({ onSlidesGenerated, onStartBlank, onRestoreDraft }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [density, setDensity] = useState('balanced');
  const [savedDraft, setSavedDraft] = useState(null);
  const [fetchedArticle, setFetchedArticle] = useState(null); // preview state

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cd-last-draft');
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.v === 2 && d.slides?.length) setSavedDraft(d);
      }
    } catch (_) {}
  }, []);

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    // Quick client-side URL validation
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setError('Please enter a valid https:// URL.');
        return;
      }
    } catch {
      setError('Invalid URL — please paste the full article link.');
      return;
    }
    setLoading(true);
    setError(null);
    setFetchedArticle(null);

    try {
      const post = await fetchPostByUrl(trimmed);
      const article = parsePostToArticle(post);
      setFetchedArticle(article);
    } catch (err) {
      setError(err.message || 'Failed to fetch article. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!fetchedArticle) return;
    const slides = generateSlides(fetchedArticle, { density });
    onSlidesGenerated(slides, fetchedArticle, density);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      if (fetchedArticle) handleGenerate();
      else handleFetch();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <img src={CONFIG.brand.logoWhite} alt={CONFIG.brand.name} className="h-8 mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl font-bold text-white mb-2">Content Designer</h2>
          <p className="text-sm text-white/40 max-w-sm mx-auto">
            Generate carousel slides, stories, captions &amp; tweets from a {CONFIG.brand.name} article — or start from scratch.
          </p>
        </div>

        {/* Density selector */}
        <div className="mb-6">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-2.5 block">Carousel Density</label>
          <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
            {DENSITY_OPTIONS.map(({ id, icon: Icon, label, desc }) => (
              <button
                key={id}
                onClick={() => setDensity(id)}
                className={`flex-1 py-2.5 px-2 rounded-lg text-center transition-all flex flex-col items-center gap-1 ${
                  density === id
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-white/35 hover:text-white/55'
                }`}
              >
                <Icon size={14} />
                <span className="text-[11px] font-semibold">{label}</span>
                <span className={`text-[9px] ${density === id ? 'text-white/50' : 'text-white/20'}`}>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* From Article */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Link size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder={`https://${CONFIG.brand.domain}/your-article-slug/`}
              className="w-full pl-11 pr-4 py-4 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white placeholder-white/25 outline-none text-sm transition-all focus:border-white/20 focus:bg-white/[0.08]"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs px-1">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Article preview card — shown after fetch */}
          {fetchedArticle && !loading && (
            <div className="rounded-xl border border-white/[0.1] bg-white/[0.04] p-4 flex gap-3 items-start">
              {fetchedArticle.featureImage && (
                <img src={fetchedArticle.featureImage} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 opacity-90" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">{fetchedArticle.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {fetchedArticle.primaryTag && (
                    <span className="text-[10px] text-violet-400/70 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">{fetchedArticle.primaryTag}</span>
                  )}
                  {(fetchedArticle.tags || []).filter(s => typeof s === 'string' && s && !s.startsWith('hash-')).slice(0, 2).map(slug => (
                    <span key={slug} className="text-[10px] text-white/30 bg-white/[0.05] border border-white/[0.08] rounded-full px-2 py-0.5">{slug.replace(/-/g, ' ')}</span>
                  ))}
                  <span className="text-[10px] text-white/30">{fetchedArticle.readingTime} min read</span>
                  {fetchedArticle.primaryAuthor && <span className="text-[10px] text-white/20">by {fetchedArticle.primaryAuthor}</span>}
                </div>
              </div>
              <button onClick={() => { setFetchedArticle(null); }} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 mt-0.5" title="Clear"><X size={14} /></button>
            </div>
          )}

          {fetchedArticle ? (
            <button
              onClick={handleGenerate}
              className="w-full py-4 bg-white text-neutral-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all"
            >
              Generate Carousel <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="w-full py-4 bg-white text-neutral-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Fetching Article...</>
              ) : (
                <>Fetch Article <ArrowRight size={16} /></>
              )}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] text-white/20 font-medium uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Start Blank */}
        <button
          onClick={() => onStartBlank()}
          className="w-full py-4 bg-white/[0.04] border border-white/[0.08] text-white/70 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15] transition-all"
        >
          <PenLine size={16} /> Start Blank
        </button>

        {/* Restore draft */}
        {savedDraft && (
          <>
            <div className="flex items-center gap-3 mt-4 mb-4">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] text-white/20 font-medium uppercase tracking-wider">draft</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onRestoreDraft?.(savedDraft)}
                className="flex-1 py-3 bg-violet-500/10 border border-violet-500/25 text-violet-300/80 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all"
              >
                <span className="text-lg">↩</span>
                <span className="font-medium">Restore draft</span>
                {savedDraft.articleTitle && (
                  <span className="text-[10px] text-violet-400/50 truncate max-w-[100px]">{savedDraft.articleTitle}</span>
                )}
              </button>
              <button
                onClick={() => { localStorage.removeItem('cd-last-draft'); setSavedDraft(null); }}
                className="px-4 py-3 bg-white/[0.03] border border-white/[0.08] text-white/25 rounded-xl text-sm hover:text-red-400/70 hover:border-red-500/20 transition-all flex-shrink-0"
                title="Discard draft"
              >✕</button>
            </div>
            <p className="text-center text-[9px] text-white/15 mt-1.5">
              {(() => { const d = savedDraft?.savedAt ? new Date(savedDraft.savedAt) : null; return d && !isNaN(d.getTime()) ? `Saved ${d.toLocaleString()}` : 'Saved: —'; })()}
            </p>
          </>
        )}
        {/* Hint */}
        <p className="text-center text-[11px] text-white/15 mt-6">
          Generates carousel slides, stories, captions &amp; tweets — all editable
        </p>
      </div>
    </div>
  );
}
