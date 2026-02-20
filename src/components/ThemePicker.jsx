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
      <div className="grid grid-cols-3 gap-1.5">
        {themeEntries.map(([key, t]) => {
          const isActive = activeThemeId === key;
          const bgColor = t.isDynamic && dynamicPreview ? dynamicPreview.bg : t.preview.bg;
          const accentColor = t.isDynamic && dynamicPreview ? dynamicPreview.accent : t.accent;
          return (
            <button
              key={key}
              onClick={() => onThemeChange(key)}
              className={`relative rounded-lg border transition-all overflow-hidden flex flex-col ${
                isActive ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-white/[0.08] hover:border-white/20'
              }`}
              title={t.name}
            >
              {/* Color preview */}
              <div className="relative flex items-center justify-center h-8 overflow-hidden" style={{ background: bgColor }}>
                {t.isDynamic ? (
                  <Wand2 size={12} color={dynamicPreview ? dynamicPreview.text : '#fff'} />
                ) : isActive ? (
                  <Check size={12} color={t.preview.fg} strokeWidth={3} />
                ) : (
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor || t.preview.fg }} />
                )}
                {/* Accent stripe at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b" style={{ backgroundColor: accentColor || t.preview.fg }} />
              </div>
              {/* Label */}
              <div className={`text-[8px] font-semibold text-center py-1 leading-none tracking-wide ${
                isActive ? 'text-violet-400 bg-violet-500/10' : 'text-white/30 bg-white/[0.03]'
              }`}>
                {t.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
