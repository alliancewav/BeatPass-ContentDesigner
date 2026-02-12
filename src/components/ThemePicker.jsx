import React from 'react';
import { Check, Wand2 } from 'lucide-react';
import THEMES from '../lib/themes';

export default function ThemePicker({ activeThemeId, onThemeChange, dynamicPreview }) {
  const themeEntries = Object.entries(THEMES);

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
        Theme
      </label>
      <div className="grid grid-cols-5 gap-1.5">
        {themeEntries.map(([key, t]) => {
          const isActive = activeThemeId === key;
          const previewBg = t.isDynamic && dynamicPreview
            ? dynamicPreview.bg
            : typeof t.preview.bg === 'string' && t.preview.bg.startsWith('linear')
              ? t.preview.bg
              : t.preview.bg;

          return (
            <button
              key={key}
              onClick={() => onThemeChange(key)}
              className={`relative h-10 rounded-lg border transition-all overflow-hidden ${
                isActive
                  ? 'border-violet-500 ring-2 ring-violet-500/30'
                  : 'border-white/[0.08] hover:border-white/20'
              }`}
              title={t.name}
            >
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background: previewBg,
                  backgroundColor: typeof previewBg === 'string' && !previewBg.startsWith('linear') ? previewBg : undefined,
                }}
              >
                {t.isDynamic ? (
                  <Wand2 size={14} color={dynamicPreview ? dynamicPreview.text : '#fff'} />
                ) : isActive ? (
                  <Check size={14} color={t.preview.fg} strokeWidth={3} />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.preview.fg }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
