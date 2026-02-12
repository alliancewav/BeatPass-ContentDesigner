import React, { useState } from 'react';
import { Link, ArrowRight, AlertCircle, Loader2, PenLine } from 'lucide-react';
import { fetchPostByUrl, parsePostToArticle } from '../lib/ghostApi';
import { generateSlides } from '../lib/slideGenerator';
import CONFIG from '../config';

export default function ArticleFetcher({ onSlidesGenerated, onStartBlank }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const post = await fetchPostByUrl(url);
      const article = parsePostToArticle(post);
      const slides = generateSlides(article);
      onSlidesGenerated(slides, article);
    } catch (err) {
      setError(err.message || 'Failed to fetch article. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleGenerate();
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

          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            className="w-full py-4 bg-white text-neutral-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Fetching Article...
              </>
            ) : (
              <>
                Generate from Article <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] text-white/20 font-medium uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Start Blank */}
        <button
          onClick={() => typeof onStartBlank === 'function' && onStartBlank()}
          className="w-full py-4 bg-white/[0.04] border border-white/[0.08] text-white/70 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15] transition-all"
        >
          <PenLine size={16} /> Start Blank
        </button>

        {/* Hint */}
        <p className="text-center text-[11px] text-white/15 mt-6">
          Generates carousel slides, stories, captions &amp; tweets — all editable
        </p>
      </div>
    </div>
  );
}
