'use client';

import React, { useState } from 'react';
import { useAppSettings, PRESET_THEMES } from '../../lib/useSettings';
import { Settings as SettingsIcon, Palette, Volume2, Eye, Sliders, Zap, Check } from 'lucide-react';
import { soundSystem } from '../../lib/audio';

const PALETTE_SWATCHES = [
  { name: 'Maple Light', hex: '#f0d9b5' },
  { name: 'Walnut Dark', hex: '#b58863' },
  { name: 'Antique Ivory', hex: '#ede3d1' },
  { name: 'Mahogany Dark', hex: '#8a6240' },
  { name: 'Tournament Baize', hex: '#5b7c4b' },
  { name: 'Parchment White', hex: '#eeeed2' },
  { name: 'Smoked Oak', hex: '#3a332d' },
  { name: 'Slate Gray', hex: '#64748b' },
];

export default function SettingsPage() {
  const { settings, updateSettings } = useAppSettings();
  const [copiedStatus, setCopiedStatus] = useState(false);

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
        <h1 className="text-2xl font-serif font-bold text-parchment-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-brass-400" />
          <span>Preferences</span>
        </h1>
        <p className="text-xs text-parchment-400 mt-1">Customize board appearance, square colors, audio, and move indicators</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Appearance & Themes Card */}
        <div className="bg-wood-900 border border-wood-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
            <Palette className="w-4 h-4 text-brass-400" />
            <span>Board Themes</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(PRESET_THEMES).map(([name, colors]) => {
              const isSelected = settings.themeName === name;
              return (
                <button
                  key={name}
                  onClick={() => updateSettings({ themeName: name as any })}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brass-400 bg-wood-850 shadow-lg'
                      : 'border-wood-800 bg-wood-950/60 hover:bg-wood-850'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 shadow border border-wood-700">
                    <div style={{ backgroundColor: colors.light }} />
                    <div style={{ backgroundColor: colors.dark }} />
                    <div style={{ backgroundColor: colors.dark }} />
                    <div style={{ backgroundColor: colors.light }} />
                  </div>
                  <span className="text-xs font-semibold capitalize text-parchment-200">
                    {name.replace('_', ' ')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Color Swatches Picker */}
          <div className="p-4 rounded-xl bg-wood-950 border border-wood-800 flex flex-col gap-4">
            <div>
              <span className="text-xs font-bold text-parchment-200 block uppercase tracking-wider">Custom Square Colors</span>
              <span className="text-[11px] text-parchment-400">Select curated wood swatches or enter hex codes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-parchment-400 font-medium">Light Squares:</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg border border-wood-700 shadow-inner"
                    style={{ backgroundColor: settings.customLight }}
                  />
                  <input
                    type="text"
                    value={settings.customLight}
                    onChange={(e) => updateSettings({ customLight: e.target.value, themeName: 'custom' })}
                    className="w-28 px-2 py-1.5 rounded-lg custom-input font-mono text-xs text-parchment-100 uppercase"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PALETTE_SWATCHES.slice(0, 4).map((swatch) => (
                    <button
                      key={swatch.name}
                      title={swatch.name}
                      onClick={() => updateSettings({ customLight: swatch.hex, themeName: 'custom' })}
                      className="w-6 h-6 rounded-md border border-wood-700 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-parchment-400 font-medium">Dark Squares:</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg border border-wood-700 shadow-inner"
                    style={{ backgroundColor: settings.customDark }}
                  />
                  <input
                    type="text"
                    value={settings.customDark}
                    onChange={(e) => updateSettings({ customDark: e.target.value, themeName: 'custom' })}
                    className="w-28 px-2 py-1.5 rounded-lg custom-input font-mono text-xs text-parchment-100 uppercase"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PALETTE_SWATCHES.slice(4).map((swatch) => (
                    <button
                      key={swatch.name}
                      title={swatch.name}
                      onClick={() => updateSettings({ customDark: swatch.hex, themeName: 'custom' })}
                      className="w-6 h-6 rounded-md border border-wood-700 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Card */}
        <div className="bg-wood-900 border border-wood-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-brass-400" />
            <span>Sound Effects</span>
          </h2>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-parchment-200 block">Move Audio</span>
                <span className="text-[11px] text-parchment-400">Play acoustic piece clicks, checks, and game results</span>
              </div>
              <button
                onClick={() => handleSoundToggle(!settings.soundEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  settings.soundEnabled ? 'bg-brass-600' : 'bg-wood-950 border border-wood-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                    settings.soundEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {settings.soundEnabled && (
              <div className="flex items-center gap-4 pt-2">
                <span className="text-[11px] text-parchment-400 w-24">Master Volume:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 accent-brass-500 h-1.5 bg-wood-950 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-parchment-300 w-10 text-right">
                  {Math.round(settings.volume * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Board Guides Card */}
        <div className="bg-wood-900 border border-wood-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
          <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
            <Eye className="w-4 h-4 text-brass-400" />
            <span>Visual Guides</span>
          </h2>

          <div className="flex items-center justify-between py-2 border-b border-wood-800">
            <div>
              <span className="text-xs font-bold text-parchment-200 block">Board Coordinates</span>
              <span className="text-[11px] text-parchment-400">Display ranks (1-8) and files (a-h) along the board edge</span>
            </div>
            <button
              onClick={() => updateSettings({ showCoordinates: !settings.showCoordinates })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.showCoordinates ? 'bg-brass-600' : 'bg-wood-950 border border-wood-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                  settings.showCoordinates ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-wood-800">
            <div>
              <span className="text-xs font-bold text-parchment-200 block">Highlight Last Move</span>
              <span className="text-[11px] text-parchment-400">Shade origin and destination squares of the previous move</span>
            </div>
            <button
              onClick={() => updateSettings({ highlightLastMove: !settings.highlightLastMove })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.highlightLastMove ? 'bg-brass-600' : 'bg-wood-950 border border-wood-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                  settings.highlightLastMove ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-xs font-bold text-parchment-200 block">Legal Move Indicators</span>
              <span className="text-[11px] text-parchment-400">Show destination dots and capture rings for selected pieces</span>
            </div>
            <button
              onClick={() => updateSettings({ highlightLegalMoves: !settings.highlightLegalMoves })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.highlightLegalMoves ? 'bg-brass-600' : 'bg-wood-950 border border-wood-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                  settings.highlightLegalMoves ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Gameplay & Move Mechanics Card */}
        <div className="bg-wood-900 border border-wood-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
          <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brass-400" />
            <span>Gameplay & Mechanics</span>
          </h2>

          <div className="flex items-center justify-between py-2 border-b border-wood-800">
            <div>
              <span className="text-xs font-bold text-parchment-200 block">Premoves</span>
              <span className="text-[11px] text-parchment-400">Queue your next move during opponent turn for sub-50ms execution</span>
            </div>
            <button
              onClick={() => updateSettings({ enablePremoves: !settings.enablePremoves })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.enablePremoves ? 'bg-brass-600' : 'bg-wood-950 border border-wood-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                  settings.enablePremoves ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-wood-800">
            <div>
              <span className="text-xs font-bold text-parchment-200 block">Auto-Promote to Queen</span>
              <span className="text-[11px] text-parchment-400">Instantly promote pawns to queen without opening the promotion dialog</span>
            </div>
            <button
              onClick={() => updateSettings({ autoQueenPromotion: !settings.autoQueenPromotion })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.autoQueenPromotion ? 'bg-brass-600' : 'bg-wood-950 border border-wood-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                  settings.autoQueenPromotion ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-xs font-bold text-parchment-200 block">Auto-Flip When Playing Black</span>
              <span className="text-[11px] text-parchment-400">Automatically orient the board so your pieces are on the bottom</span>
            </div>
            <button
              onClick={() => updateSettings({ autoFlipWhenBlack: !settings.autoFlipWhenBlack })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.autoFlipWhenBlack ? 'bg-brass-600' : 'bg-wood-950 border border-wood-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                  settings.autoFlipWhenBlack ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
