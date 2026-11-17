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
};

const STORAGE_KEY = 'schoolchess_user_settings_v1';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // Fallback to default
    }
    setIsLoaded(true);
  }, []);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // LocalStorage quota or disabled
      }
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
