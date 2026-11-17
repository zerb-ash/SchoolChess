'use client';

import React from 'react';
import { useAppSettings, PRESET_THEMES } from '../../lib/useSettings';
import { Settings as SettingsIcon, Palette, Volume2, Eye, Download, Upload } from 'lucide-react';
import { soundSystem } from '../../lib/audio';

export default function SettingsPage() {
  const { settings, updateSettings, themeColors } = useAppSettings();

  const handleVolumeChange = (vol: number) => {
    updateSettings({ volume: vol });
    soundSystem.setVolume(vol);
  };

  const handleSoundToggle = (enabled: boolean) => {
    updateSettings({ soundEnabled: enabled });
    soundSystem.setEnabled(enabled);
    if (enabled) {
      soundSystem.playMove();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-400" />
          <span>Platform Settings</span>
        </h1>
        <p className="text-sm text-zinc-400">Customize board appearance, piece graphics, audio, and gameplay behavior</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Appearance & Themes Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Palette className="w-4 h-4 text-emerald-400" />
            <span>Board Themes & Colors</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(PRESET_THEMES).map(([name, colors]) => {
              const isSelected = settings.themeName === name;
              return (
                <button
                  key={name}
                  onClick={() => updateSettings({ themeName: name as any })}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-lg'
                      : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 shadow border border-zinc-700">
                    <div style={{ backgroundColor: colors.light }} />
                    <div style={{ backgroundColor: colors.dark }} />
                    <div style={{ backgroundColor: colors.dark }} />
                    <div style={{ backgroundColor: colors.light }} />
                  </div>
                  <span className="text-xs font-semibold capitalize text-zinc-300">{name}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Color Pickers */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-zinc-200 block">Custom Square Colors</span>
              <span className="text-xs text-zinc-400">Define custom hex codes for light and dark squares</span>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                <span>Light:</span>
                <input
                  type="color"
                  value={settings.customLight}
                  onChange={(e) => {
                    updateSettings({ customLight: e.target.value, themeName: 'custom' });
                  }}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                <span>Dark:</span>
                <input
                  type="color"
                  value={settings.customDark}
                  onChange={(e) => {
                    updateSettings({ customDark: e.target.value, themeName: 'custom' });
                  }}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Audio Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Sound & Audio Effects</span>
          </h2>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-zinc-200 block">Sound Effects</span>
                <span className="text-xs text-zinc-400">Play acoustic piece clicks, checks, and game ending chords</span>
              </div>
              <button
                onClick={() => handleSoundToggle(!settings.soundEnabled)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                  settings.soundEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {settings.soundEnabled && (
              <div className="flex items-center gap-4 pt-2">
                <span className="text-xs text-zinc-400 w-24">Master Volume:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-zinc-300 w-10 text-right">
                  {Math.round(settings.volume * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gameplay & Visual Guides Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Board Guides & Visuals</span>
          </h2>

          <div className="divide-y divide-zinc-800">
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Board Coordinates</span>
                <span className="text-[11px] text-zinc-400">Show letters (a-h) and numbers (1-8)</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showCoordinates}
                onChange={(e) => updateSettings({ showCoordinates: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Highlight Last Move</span>
                <span className="text-[11px] text-zinc-400">Shade the starting and landing squares of previous move</span>
              </div>
              <input
                type="checkbox"
                checked={settings.highlightLastMove}
                onChange={(e) => updateSettings({ highlightLastMove: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Legal Move Destination Dots</span>
                <span className="text-[11px] text-zinc-400">Show dots and capture rings for selected pieces</span>
              </div>
              <input
                type="checkbox"
                checked={settings.highlightLegalMoves}
                onChange={(e) => updateSettings({ highlightLegalMoves: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

