import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Theme,
  TypographySettings,
  ReadingSettings,
  defaultThemes,
  defaultTypography,
  defaultReadingSettings,
} from '@/types/theme';
import { logger, captureError } from '@/utils/logger';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
  addCustomTheme: (theme: Theme) => void;
  removeCustomTheme: (themeId: string) => void;
  typography: TypographySettings;
  setTypography: (settings: Partial<TypographySettings>) => void;
  readingSettings: ReadingSettings;
  setReadingSettings: (settings: Partial<ReadingSettings>) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@miyo/theme';
const TYPOGRAPHY_STORAGE_KEY = '@miyo/typography';
const READING_SETTINGS_KEY = '@miyo/reading-settings';
const CUSTOM_THEMES_KEY = '@miyo/custom-themes';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultThemes[0]);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [typography, setTypographyState] = useState<TypographySettings>(defaultTypography);
  const [readingSettings, setReadingSettingsState] = useState<ReadingSettings>(defaultReadingSettings);
  const [isLoading, setIsLoading] = useState(true);

  const themes = [...defaultThemes, ...customThemes];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [themeId, typographyJson, readingJson, customThemesJson] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(TYPOGRAPHY_STORAGE_KEY),
        AsyncStorage.getItem(READING_SETTINGS_KEY),
        AsyncStorage.getItem(CUSTOM_THEMES_KEY),
      ]);

      if (customThemesJson) {
        setCustomThemes(JSON.parse(customThemesJson));
      }

      if (themeId) {
        const allThemes = [...defaultThemes, ...(customThemesJson ? JSON.parse(customThemesJson) : [])];
        const savedTheme = allThemes.find(t => t.id === themeId);
        if (savedTheme) {
          setCurrentTheme(savedTheme);
        }
      }

      if (typographyJson) {
        setTypographyState({ ...defaultTypography, ...JSON.parse(typographyJson) });
      }

      if (readingJson) {
        setReadingSettingsState({ ...defaultReadingSettings, ...JSON.parse(readingJson) });
      }
      logger.info('Theme settings loaded successfully');
    } catch (error) {
      captureError('Load Theme Settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (theme: Theme) => {
    setCurrentTheme(theme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme.id);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const addCustomTheme = async (theme: Theme) => {
    const newCustomThemes = [...customThemes, { ...theme, isCustom: true }];
    setCustomThemes(newCustomThemes);
    try {
      await AsyncStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(newCustomThemes));
    } catch (error) {
      console.error('Failed to save custom theme:', error);
    }
  };

  const removeCustomTheme = async (themeId: string) => {
    const newCustomThemes = customThemes.filter(t => t.id !== themeId);
    setCustomThemes(newCustomThemes);
    try {
      await AsyncStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(newCustomThemes));
      if (currentTheme.id === themeId) {
        setTheme(defaultThemes[0]);
      }
    } catch (error) {
      console.error('Failed to remove custom theme:', error);
    }
  };

  const setTypography = async (settings: Partial<TypographySettings>) => {
    const newTypography = { ...typography, ...settings };
    setTypographyState(newTypography);
    try {
      await AsyncStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(newTypography));
    } catch (error) {
      console.error('Failed to save typography:', error);
    }
  };

  const setReadingSettings = async (settings: Partial<ReadingSettings>) => {
    const newSettings = { ...readingSettings, ...settings };
    setReadingSettingsState(newSettings);
    try {
      await AsyncStorage.setItem(READING_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save reading settings:', error);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        themes,
        addCustomTheme,
        removeCustomTheme,
        typography,
        setTypography,
        readingSettings,
        setReadingSettings,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
