import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { hashPassword } from '../lib/utils';
import CONFIG from '../config';

export default function PasswordGate({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem(CONFIG.auth.sessionKey);
    if (saved === 'true') {
      onAuthenticated();
    }
    setChecking(false);
  }, [onAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(false);
    const hash = await hashPassword(password);
    if (hash === CONFIG.auth.passwordHash) {
      sessionStorage.setItem(CONFIG.auth.sessionKey, 'true');
      onAuthenticated();
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (checking) return null;

  return (
    <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.08] mb-6">
            <Lock size={28} className="text-white/60" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Content Designer</h1>
          <p className="text-sm text-white/40">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Password"
              autoFocus
              className={`w-full px-5 py-4 bg-white/[0.06] border rounded-xl text-white placeholder-white/30 outline-none transition-all text-sm ${
                error ? 'border-red-500/50 bg-red-500/[0.06]' : 'border-white/[0.08] focus:border-white/20 focus:bg-white/[0.08]'
              }`}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs px-1">
              <AlertCircle size={14} />
              <span>Incorrect password</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!password}
            className="w-full py-4 bg-white text-neutral-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center text-[11px] text-white/20 mt-8">
          {CONFIG.brand.name} — Internal Tool
        </p>
      </div>
    </div>
  );
}
