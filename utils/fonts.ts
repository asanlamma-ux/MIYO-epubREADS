/**
 * Centralized Font Configuration for Miyo EPUB Reader
 * Handles font family mapping for both native UI and WebView rendering.
 */

export interface FontOption {
  label: string;
  value: string;
  /** CSS font stack for WebView rendering */
  webStack: string;
  /** Whether this font is a serif font */
  isSerif: boolean;
  /** Google Fonts URL parameter (null for system font) */
  googleFontsParam: string | null;
}

export const fontOptions: FontOption[] = [
  {
    label: 'System Default',
    value: 'System',
    webStack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    isSerif: false,
    googleFontsParam: null,
  },
  {
    label: 'Newsreader',
    value: 'Newsreader',
    webStack: '"Newsreader", "Times New Roman", Georgia, serif',
    isSerif: true,
    googleFontsParam: 'Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400',
  },
  {
    label: 'Crimson Pro',
    value: 'Crimson Pro',
    webStack: '"Crimson Pro", "Times New Roman", Georgia, serif',
    isSerif: true,
    googleFontsParam: 'Crimson+Pro:ital,wght@0,400;0,600;1,400',
  },
  {
    label: 'Lora',
    value: 'Lora',
    webStack: '"Lora", "Times New Roman", Georgia, serif',
    isSerif: true,
    googleFontsParam: 'Lora:ital,wght@0,400;0,700;1,400',
  },
  {
    label: 'IBM Plex Sans',
    value: 'IBM Plex Sans',
    webStack: '"IBM Plex Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
    isSerif: false,
    googleFontsParam: 'IBM+Plex+Sans:wght@400;500;600',
  },
  {
    label: 'JetBrains Mono',
    value: 'JetBrains Mono',
    webStack: '"JetBrains Mono", "Courier New", Courier, monospace',
    isSerif: false,
    googleFontsParam: 'JetBrains+Mono:wght@400;500',
  },
  {
    label: 'Merriweather',
    value: 'Merriweather',
    webStack: '"Merriweather", Georgia, "Times New Roman", serif',
    isSerif: true,
    googleFontsParam: 'Merriweather:ital,wght@0,400;0,700;1,400',
  },
  {
    label: 'Open Sans',
    value: 'Open Sans',
    webStack: '"Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
    isSerif: false,
    googleFontsParam: 'Open+Sans:wght@400;500;600',
  },
];

/**
 * Get the CSS font-family stack for a given font value
 */
export function getFontStack(fontValue: string): string {
  const found = fontOptions.find(f => f.value === fontValue);
  if (found) return found.webStack;
  // Fallback: wrap in quotes and add generic serif
  return `"${fontValue}", Georgia, serif`;
}

/**
 * Google Fonts link for the active reader font only (faster load, stays in sync with font list).
 */
export function getGoogleFontsLink(fontValue: string): string {
  if (fontValue === 'System') return '';
  const opt = fontOptions.find(f => f.value === fontValue);
  if (!opt?.googleFontsParam) return '';

  return `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${opt.googleFontsParam}&display=swap" rel="stylesheet">`;
}
