'use client';

import { useState, useEffect } from 'react';

export interface BoardThemeColors {
  light: string;
  dark: string;
}

export const PRESET_THEMES: Record<string, BoardThemeColors> = {
  walnut: { light: '#f0d9b5', dark: '#b58863' },
  classic_salon: { light: '#ede3d1', dark: '#8a6240' },
  tournament: { light: '#eeeed2', dark: '#5b7c4b' },
  obsidian: { light: '#e2d9c8', dark: '#3a332d' },
};

export interface AppSettings {
  themeName: 'walnut' | 'classic_salon' | 'tournament' | 'obsidian' | 'custom';
  customLight: string;
  customDark: string;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  highlightLegalMoves: boolean;
  soundEnabled: boolean;
  volume: number;
  enablePremoves: boolean;
  autoQueenPromotion: boolean;
  autoFlipWhenBlack: boolean;
  highContrastHighlight: boolean;
  confirmMove: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeName: 'walnut',
  customLight: '#f0d9b5',
  customDark: '#b58863',
  showCoordinates: true,
  highlightLastMove: true,
  highlightLegalMoves: true,
  soundEnabled: true,
  volume: 0.7,
  enablePremoves: true,
  autoQueenPromotion: false,
  autoFlipWhenBlack: true,
  highContrastHighlight: false,
  confirmMove: false,
};

const STORAGE_KEY = 'schoolchess_user_settings_v1';

const getInitialSettings = (): AppSettings => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {}
  }
  return DEFAULT_SETTINGS;
};

function applyCssTheme(s: AppSettings) {
  if (typeof document === 'undefined') return;
  const colors =
    s.themeName === 'custom'
      ? { light: s.customLight, dark: s.customDark }
      : PRESET_THEMES[s.themeName] || PRESET_THEMES.walnut;
  document.documentElement.style.setProperty('--board-light', colors.light);
  document.documentElement.style.setProperty('--board-dark', colors.dark);
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        setSettings(parsed);
        applyCssTheme(parsed);
      } else {
        applyCssTheme(DEFAULT_SETTINGS);
      }
    } catch {
      applyCssTheme(DEFAULT_SETTINGS);
    }
    setIsLoaded(true);

    const handleSync = (e: Event) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
          setSettings(parsed);
          applyCssTheme(parsed);
        }
      } catch {}
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('schoolchess_settings_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('schoolchess_settings_updated', handleSync);
    };
  }, []);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        applyCssTheme(next);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('schoolchess_settings_updated', { detail: next }));
        }
      } catch {}
      return next;
    });
  };

  const currentThemeColors: BoardThemeColors =
    settings.themeName === 'custom'
      ? { light: settings.customLight, dark: settings.customDark }
      : PRESET_THEMES[settings.themeName] || PRESET_THEMES.walnut;

  return {
    settings,
    updateSettings,
    currentThemeColors,
    themeColors: currentThemeColors,
    isLoaded,
  };
}
