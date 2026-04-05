# MIYO Epub Reader

A comprehensive, enterprise-grade EPUB reader app built with React Native / Expo.

## Architecture

- **Framework**: React Native + Expo (SDK 54), Expo Router for navigation
- **State Management**: React Context (ThemeContext, LibraryContext)
- **Animations**: React Native Reanimated 3 (spring-based, smooth)
- **UI**: Custom design system with themed components

## Project Structure

```
app/
  (tabs)/         # Tab-based navigation (Home, Library, History, Settings)
  reader/[id].tsx # Main EPUB reader screen
  
components/
  ui/             # Base UI (ThemedText, ThemedView, PressableScale)
  library/        # Library screen components (BookCard, BookActionModal, etc.)
  reader/         # Reader components:
    SelectionToolbar.tsx  - Koodo-style dark floating toolbar (Note/Highlight/Copy/Share/Dictionary/Translate + color pickers)
    SearchInBookModal.tsx - Full-text search across all chapters with highlighted excerpts
    AnnotationsDrawer.tsx - Tabbed panel (Highlights + Bookmarks) with delete actions
    ReadingStatsModal.tsx - Reading progress, estimated time, word count stats
    BookLoadingAnimation.tsx - Animated loading screen
    
context/
  ThemeContext.tsx   - Theme, typography, reading settings
  LibraryContext.tsx - Books, bookmarks, highlights, reading positions
  
types/
  book.ts   - Book, Bookmark, Highlight, ReadingPosition types
  theme.ts  - TypographySettings, ReadingSettings, ReadingTheme types
  
utils/
  epub-parser.ts - EPUB file parsing (JSZip + XML parsing)
  logger.ts      - Structured logging utility
```

## Key Features

- **EPUB Reader**: epub.js-powered rendering (CDN: epubjs@0.3.93) - loads full epub as base64, renders via WebView with theme injection, JS navigation commands (__goNext/__goPrev/__goToChapter), text selection and tap tracking via rendered content events
- **Koodo-style Selection Toolbar**: Dark floating toolbar with 6 actions, expandable color picker, note modal
- **Search in Book**: Full-text search across all chapters with context excerpts
- **Annotations**: Highlights and bookmarks management with chapter navigation
- **Reading Stats**: Progress percentage, estimated reading time, word count
- **Typography**: Font size, line height, paragraph spacing, text alignment
- **Themes**: Multiple reading themes (Dark, Light, Sepia, Soft Paper, Forest, etc.)
- **Library**: Grid/list view, sort/filter, search, import from device
- **Persistence**: AsyncStorage for all reading positions, highlights, bookmarks

## Development

```bash
cd MIYO-Epub-ReaderkomodoClonezip && npx expo start --web --port 5000
```

## Dependencies

- expo-document-picker: File import
- expo-file-system: File operations
- expo-haptics: Touch feedback
- react-native-webview: EPUB rendering
- react-native-reanimated: Animations
- lucide-react-native: Icons
- jszip: EPUB parsing
