'use client';

import { useState, useEffect } from 'react';

export interface BoardThemeColors {
  light: string;
  dark: string;
}

export const PRESET_THEMES: Record<string, BoardThemeColors> = {
  brown: { light: '#f0d9b5', dark: '#b58863' },
  green: { light: '#eeeed2', dark: '#769656' },
  blue: { light: '#dee3e6', dark: '#8ca2ad' },
  purple: { light: '#f8f8f2', dark: '#6272a4' },
  dark: { light: '#a3a3a3', dark: '#404040' },
};

export interface AppSettings {
  themeName: 'brown' | 'green' | 'blue' | 'purple' | 'dark' | 'custom';
  customLight: string;
  customDark: string;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  highlightLegalMoves: boolean;
  soundEnabled: boolean;
  volume: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeName: 'green',
  customLight: '#E8EDF2',
  customDark: '#64748B',
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
        // LocalStorage fallback
      }
      return next;
    });
  };

  const getThemeColors = (): BoardThemeColors => {
    if (settings.themeName === 'custom') {
      return { light: settings.customLight, dark: settings.customDark };
    }
    return PRESET_THEMES[settings.themeName] || PRESET_THEMES.green;
  };

  return {
    settings,
    updateSettings,
    themeColors: getThemeColors(),
    isLoaded,
  };
}

