import React, { useState } from 'react';
import { Link, ArrowRight, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { fetchPostByUrl, parsePostToArticle } from '../lib/ghostApi';
import { generateSlides } from '../lib/slideGenerator';
import CONFIG from '../config';

export default function ArticleFetcher({ onSlidesGenerated }) {
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] mb-5">
            <Sparkles size={24} className="text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Generate Carousel</h2>
          <p className="text-sm text-white/40 max-w-sm mx-auto">
            Paste a {CONFIG.brand.name} article URL to auto-generate Instagram carousel slides.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-3">
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
                Generate Slides <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Hint */}
        <p className="text-center text-[11px] text-white/15 mt-6">
          Uses Ghost Content API — works with any published {CONFIG.brand.name} article
        </p>
      </div>
    </div>
  );
}
