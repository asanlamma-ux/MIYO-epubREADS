import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
  StatusBar,
  Alert,
  Share,
  Linking,
  ScrollView,
  InteractionManager,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import ReaderWebView from '@/components/reader/ReaderWebView';
import { getInfoAsync as getFileInfoAsync } from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Brightness from 'expo-brightness';
import * as NavigationBar from 'expo-navigation-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { useTerms } from '@/context/TermsContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { parseEpub, ParsedEpub, type EpubChapter } from '@/utils/epub-parser';
import { logger, captureError } from '@/utils/logger';
import {
  startReadingSession,
  endReadingSession,
  recordWordsRead,
  getReadingStats,
} from '@/utils/reading-stats';
import { annotationsToMarkdown, annotationsToPlainText } from '@/utils/export-annotations';
import { Book } from '@/types/book';
import { fontOptions } from '@/types/theme';
import { getFontStack, getGoogleFontsLink } from '@/utils/fonts';
import { BookLoadingAnimation } from '@/components/reader/BookLoadingAnimation';
import { SelectionToolbar, SelectionData, HighlightData } from '@/components/reader/SelectionToolbar';
import { SearchInBookModal } from '@/components/reader/SearchInBookModal';
import { AnnotationsDrawer } from '@/components/reader/AnnotationsDrawer';
import { ReaderLayoutPanel } from '@/components/reader/ReaderLayoutPanel';
import { ReadingStatsModal } from '@/components/reader/ReadingStatsModal';
import { TranslationSheet } from '@/components/reader/TranslationSheet';
import { AddTermModal } from '@/components/terms/AddTermModal';
import {
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Type,
  List,
  Sun,
  Moon,
  Minus,
  Plus,
  AlignLeft,
  AlignJustify,
  Palette,
  X,
  Search,
  Layers,
  BarChart2,
  Columns,
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

function countChapterWords(ch: Pick<EpubChapter, 'content' | 'wordCount'>): number {
  if (ch.wordCount != null) return ch.wordCount;
  return ch.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentTheme,
    typography,
    readingSettings,
    themes,
    setTheme,
    setTypography,
    setReadingSettings,
  } = useTheme();
  const {
    getBook,
    updateBook,
    saveReadingPosition,
    getReadingPosition,
    addBookmark,
    getBookmarksByBook,
    removeBookmark,
    addHighlight,
    getHighlightsByBook,
    removeHighlight,
    highlights,
    bookmarks,
  } = useLibrary();
  const { getReplacementMap } = useTerms();

  const [book, setBook] = useState<Book | null>(null);
  const [parsedEpub, setParsedEpub] = useState<ParsedEpub | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showTypographyPanel, setShowTypographyPanel] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [chapterScrollPercent, setChapterScrollPercent] = useState(0);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [chapterHighlights, setChapterHighlights] = useState<any[]>([]);
  const [searchHighlightTerm, setSearchHighlightTerm] = useState('');
  const [estimatedWordsRead, setEstimatedWordsRead] = useState(0);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [showAddTermModal, setShowAddTermModal] = useState(false);
  const [addTermInitialText, setAddTermInitialText] = useState('');
  const [paceWpm, setPaceWpm] = useState(200);
  const [translationSheet, setTranslationSheet] = useState<{ open: boolean; text: string }>({
    open: false,
    text: '',
  });
  const [sleepDeadlineMs, setSleepDeadlineMs] = useState<number | null>(null);
  const [sleepUiTick, setSleepUiTick] = useState(0);

  const webViewRef = useRef<React.ComponentRef<typeof ReaderWebView>>(null);
  const pendingChapterAnchorRef = useRef<string | null>(null);
  const chapterScrollPercentRef = useRef(0);
  const lastScrollPositionRef = useRef(0);
  const chapterIndexRef = useRef(0);
  const persistScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordsRecordedRef = useRef(0);
  const toolbarOpacity = useSharedValue(0);
  const progressOpacity = useSharedValue(1);
  const toolbarTranslateY = useSharedValue(-20);

  // Load book and parse EPUB
  useEffect(() => {
    const loadBook = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        setLoadError(null);

        const foundBook = getBook(id);
        if (!foundBook) {
          setLoadError('Book not found in library');
          setIsLoading(false);
          return;
        }

        setBook(foundBook);

        const fileInfo = await getFileInfoAsync(foundBook.filePath);
        if (!fileInfo.exists) {
          setLoadError('EPUB file not found. It may have been moved or deleted.');
          setIsLoading(false);
          return;
        }

        logger.info('Parsing EPUB for reading', { title: foundBook.title });
        await new Promise<void>(resolve => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        const parsed = await parseEpub(foundBook.filePath);
        setParsedEpub(parsed);

        const savedPosition = await getReadingPosition(id);
        if (savedPosition && savedPosition.chapterIndex < parsed.chapters.length) {
          setCurrentChapterIndex(savedPosition.chapterIndex);
          setLastScrollPosition(savedPosition.scrollPosition || 0);
        }

        await updateBook(id, {
          title: parsed.metadata.title !== 'Unknown Title' ? parsed.metadata.title : foundBook.title,
          author: parsed.metadata.author !== 'Unknown Author' ? parsed.metadata.author : foundBook.author,
          totalChapters: parsed.totalChapters,
          lastReadAt: new Date().toISOString(),
          readingStatus: 'reading',
        });

        logger.info('EPUB loaded successfully', {
          chapters: parsed.chapters.length,
          title: parsed.metadata.title,
        });
      } catch (error) {
        captureError('Load EPUB', error);
        setLoadError('Failed to load this EPUB file. The file may be corrupted or unsupported.');
      } finally {
        setIsLoading(false);
      }
    };

    loadBook();
  }, [id]);

  useEffect(() => {
    if (!book?.id) return;
    startReadingSession(book.id);
    wordsRecordedRef.current = 0;
    return () => {
      void endReadingSession();
    };
  }, [book?.id]);

  useEffect(() => {
    getReadingStats().then(s => {
      const w = s.averageWordsPerMinute;
      setPaceWpm(w >= 40 && w <= 500 ? w : 200);
    });
  }, []);

  useEffect(() => {
    if (!book?.id || !parsedEpub) return;
    const tag = 'miyo-reader';
    if (readingSettings.keepScreenOn) {
      void activateKeepAwakeAsync(tag);
    } else {
      void deactivateKeepAwake(tag);
    }
    return () => {
      void deactivateKeepAwake(tag);
    };
  }, [book?.id, parsedEpub, readingSettings.keepScreenOn]);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'android') {
        void Brightness.restoreSystemBrightnessAsync();
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const setImmersive = async () => {
        if (Platform.OS === 'android' && isActive) {
          try {
            await NavigationBar.setVisibilityAsync('hidden');
            await NavigationBar.setBehaviorAsync('overlay-swipe');
          } catch (e) {
            // ignore
          }
        }
      };

      setImmersive();

      return () => {
        isActive = false;
        if (Platform.OS === 'android') {
          try {
            NavigationBar.setVisibilityAsync('visible');
            NavigationBar.setBehaviorAsync('inset-swipe');
          } catch (e) {
            // ignore
          }
        }
      };
    }, [])
  );

  useEffect(() => {
    setChapterScrollPercent(0);
  }, [currentChapterIndex]);

  useEffect(() => {
    chapterScrollPercentRef.current = chapterScrollPercent;
  }, [chapterScrollPercent]);
  useEffect(() => {
    lastScrollPositionRef.current = lastScrollPosition;
  }, [lastScrollPosition]);
  useEffect(() => {
    chapterIndexRef.current = currentChapterIndex;
  }, [currentChapterIndex]);

  // Sync toolbar visibility with smooth animation
  useEffect(() => {
    toolbarOpacity.value = withTiming(showToolbar ? 1 : 0, { duration: 220 });
    toolbarTranslateY.value = withTiming(showToolbar ? 0 : -16, { duration: 220 });
    progressOpacity.value = withTiming(showToolbar ? 0 : 1, { duration: 220 });
  }, [showToolbar]);

  // Check bookmark status for current chapter
  useEffect(() => {
    if (!id) return;
    const allBookmarks = getBookmarksByBook(id);
    const isCurrentBookmarked = allBookmarks.some(b => b.chapterIndex === currentChapterIndex);
    setIsBookmarked(isCurrentBookmarked);

    const bookChapterHighlights = getHighlightsByBook(id).filter(
      h => h.chapterIndex === currentChapterIndex
    );
    setChapterHighlights(bookChapterHighlights);
  }, [id, currentChapterIndex, highlights, bookmarks]);

  // Estimate words read (completed chapters + scroll position in current)
  useEffect(() => {
    if (!parsedEpub) return;
    let wordCount = 0;
    for (let i = 0; i < currentChapterIndex && i < parsedEpub.chapters.length; i++) {
      const w = parsedEpub.chapters[i].wordCount;
      if (w != null) wordCount += w;
      else {
        const text = parsedEpub.chapters[i].content.replace(/<[^>]+>/g, ' ').trim();
        wordCount += text.split(/\s+/).filter(Boolean).length;
      }
    }
    const cur = parsedEpub.chapters[currentChapterIndex];
    if (cur) {
      const cw =
        cur.wordCount ??
        cur.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      wordCount += (chapterScrollPercent / 100) * cw;
    }
    const rounded = Math.round(wordCount);
    setEstimatedWordsRead(rounded);
    if (!book?.id) return;
    const delta = rounded - wordsRecordedRef.current;
    if (delta >= 40) {
      recordWordsRead(delta);
      wordsRecordedRef.current = rounded;
    }
  }, [currentChapterIndex, parsedEpub, chapterScrollPercent, book?.id]);

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
    transform: [{ translateY: toolbarTranslateY.value }],
  }));

  const bottomToolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
    transform: [{ translateY: withTiming(showToolbar ? 0 : 20, { duration: 220 }) }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const leftZoneWidth = screenWidth * 0.25;
  const rightZoneStart = screenWidth * 0.75;

  const injectScrollByPage = useCallback(
    (direction: 'up' | 'down') => {
      const ratio = Math.min(0.95, Math.max(0.35, readingSettings.tapScrollPageRatio));
      const sign = direction === 'down' ? 1 : -1;
      webViewRef.current?.injectJavaScript(`
        (function(){ window.scrollBy(0, ${sign} * window.innerHeight * ${ratio}); })();
        true;
      `);
    },
    [readingSettings.tapScrollPageRatio]
  );

  const navigateChapter = useCallback((direction: 'prev' | 'next') => {
    if (!parsedEpub) return;
    const totalChapters = parsedEpub.chapters.length;
    if (direction === 'prev' && currentChapterIndex > 0) {
      setCurrentChapterIndex(prev => prev - 1);
      setChapterScrollPercent(0);
      setShowToolbar(false);
      setSearchHighlightTerm('');
    } else if (direction === 'next' && currentChapterIndex < totalChapters - 1) {
      setCurrentChapterIndex(prev => prev + 1);
      setChapterScrollPercent(0);
      setShowToolbar(false);
      setSearchHighlightTerm('');
    }
  }, [parsedEpub, currentChapterIndex]);

  const handleTap = useCallback(
    async (x: number) => {
      if (selection) {
        setSelection(null);
        return;
      }
      if (!readingSettings.tapZonesEnabled) {
        setShowToolbar(prev => !prev);
        return;
      }
      if (x < leftZoneWidth) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (readingSettings.tapZoneNavMode === 'chapter') {
          navigateChapter('prev');
        } else {
          injectScrollByPage('up');
        }
      } else if (x > rightZoneStart) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (readingSettings.tapZoneNavMode === 'chapter') {
          navigateChapter('next');
        } else {
          injectScrollByPage('down');
        }
      } else {
        setShowToolbar(prev => !prev);
      }
    },
    [
      readingSettings.tapZonesEnabled,
      readingSettings.tapZoneNavMode,
      selection,
      navigateChapter,
      injectScrollByPage,
    ]
  );

  const goToChapter = useCallback((index: number, searchTerm?: string) => {
    setCurrentChapterIndex(index);
    setShowChapterDrawer(false);
    setSearchHighlightTerm(searchTerm || '');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleBack = useCallback(async () => {
    if (book && parsedEpub?.chapters.length) {
      const n = parsedEpub.chapters.length;
      const seg = 100 / n;
      const progress = Math.min(
        100,
        Math.round(currentChapterIndex * seg + (seg * chapterScrollPercent) / 100)
      );
      await updateBook(book.id, { progress, currentChapter: currentChapterIndex });
      await saveReadingPosition({
        bookId: book.id,
        chapterIndex: currentChapterIndex,
        scrollPosition: lastScrollPosition,
        chapterScrollPercent,
        timestamp: new Date().toISOString(),
      });
    }
    router.back();
  }, [
    book,
    parsedEpub,
    currentChapterIndex,
    chapterScrollPercent,
    lastScrollPosition,
    updateBook,
    saveReadingPosition,
    router,
  ]);

  const handleBackRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    handleBackRef.current = handleBack;
  }, [handleBack]);

  const scheduleScrollPersist = useCallback(() => {
    if (!book?.id || !parsedEpub?.chapters.length) return;
    if (persistScrollTimerRef.current) clearTimeout(persistScrollTimerRef.current);
    persistScrollTimerRef.current = setTimeout(() => {
      persistScrollTimerRef.current = null;
      const n = parsedEpub.chapters.length;
      const ci = chapterIndexRef.current;
      const csp = chapterScrollPercentRef.current;
      const lsp = lastScrollPositionRef.current;
      const seg = 100 / n;
      const pct = Math.min(100, Math.round(ci * seg + (seg * csp) / 100));
      void saveReadingPosition({
        bookId: book.id,
        chapterIndex: ci,
        scrollPosition: lsp,
        chapterScrollPercent: csp,
        timestamp: new Date().toISOString(),
      });
      void updateBook(book.id, { progress: pct, currentChapter: ci });
    }, 1500);
  }, [book?.id, parsedEpub, saveReadingPosition, updateBook]);

  useEffect(() => {
    const m = readingSettings.sleepTimerMinutes;
    if (!m || m <= 0 || !book?.id) {
      setSleepDeadlineMs(null);
      return;
    }
    setSleepDeadlineMs(Date.now() + m * 60_000);
  }, [readingSettings.sleepTimerMinutes, book?.id]);

  useEffect(() => {
    if (!sleepDeadlineMs) return;
    const id = setInterval(() => {
      setSleepUiTick(x => x + 1);
      if (Date.now() >= sleepDeadlineMs) {
        setSleepDeadlineMs(null);
        setReadingSettings({ sleepTimerMinutes: 0 });
        Alert.alert('Sleep timer', 'Your timer finished.', [
          { text: 'OK', style: 'cancel' },
          { text: 'Exit book', onPress: () => void handleBackRef.current() },
        ]);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepDeadlineMs, setReadingSettings]);

  useEffect(() => {
    const frag = pendingChapterAnchorRef.current;
    if (!frag) return;
    pendingChapterAnchorRef.current = null;
    const t = setTimeout(() => {
      const safe = JSON.stringify(frag);
      webViewRef.current?.injectJavaScript(`
        (function(){
          var id = ${safe};
          try {
            var el = document.getElementById(id) || document.querySelector('[name="' + String(id).replace(/"/g, '\\\\"') + '"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (e) {}
        })();
        true;
      `);
    }, 550);
    return () => clearTimeout(t);
  }, [currentChapterIndex]);

  const handleToggleBookmark = useCallback(async () => {
    if (!book) return;
    const allBookmarks = getBookmarksByBook(book.id);
    const existing = allBookmarks.find(b => b.chapterIndex === currentChapterIndex);

    if (existing) {
      await removeBookmark(existing.id);
      setIsBookmarked(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await addBookmark({
        id: `bm_${Date.now()}`,
        bookId: book.id,
        chapterIndex: currentChapterIndex,
        position: 0,
        text: parsedEpub?.chapters[currentChapterIndex]?.title || `Chapter ${currentChapterIndex + 1}`,
        createdAt: new Date().toISOString(),
      });
      setIsBookmarked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [book, currentChapterIndex, parsedEpub]);

  const handleHighlight = useCallback(async (data: HighlightData) => {
    if (!book) return;
    await addHighlight({
      id: `hl_${Date.now()}`,
      bookId: book.id,
      chapterIndex: currentChapterIndex,
      startOffset: 0,
      endOffset: data.text.length,
      text: data.text,
      color: data.color,
      note: data.note,
      createdAt: new Date().toISOString(),
    });
    const escapedText = data.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    webViewRef.current?.injectJavaScript(`
      (function() {
        window.__addHighlight && window.__addHighlight("${escapedText}", "${data.color}", "${data.textColor || ''}");
      })();
      true;
    `);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [book, currentChapterIndex]);

  const handleNote = useCallback(async (data: HighlightData) => {
    if (!book) return;
    await addHighlight({
      id: `hl_${Date.now()}`,
      bookId: book.id,
      chapterIndex: currentChapterIndex,
      startOffset: 0,
      endOffset: data.text.length,
      text: data.text,
      color: data.color,
      note: data.note,
      createdAt: new Date().toISOString(),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [book, currentChapterIndex]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await ExpoClipboard.setStringAsync(text);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { }
  }, []);

  const handleShare = useCallback(async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch (e) { }
  }, []);

  const handleDictionary = useCallback((text: string) => {
    const word = text.trim().split(' ')[0];
    const url = `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Dictionary', `Looking up: "${word}"\n\nPlease check your dictionary app.`);
    });
  }, []);

  const handleTranslate = useCallback((text: string) => {
    setTranslationSheet({ open: true, text });
  }, []);

  const handleWikipedia = useCallback((text: string) => {
    const q = text.trim().slice(0, 240);
    const url = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Wikipedia', 'Could not open the browser.');
    });
  }, []);

  const handleBookmarkSelection = useCallback(async (text: string) => {
    if (!book) return;
    await addBookmark({
      id: `bm_${Date.now()}`,
      bookId: book.id,
      chapterIndex: currentChapterIndex,
      position: lastScrollPosition,
      text: text.slice(0, 120),
      createdAt: new Date().toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [book, currentChapterIndex, lastScrollPosition]);

  const handleUnderline = useCallback(async (data: HighlightData) => {
    if (!book) return;
    await addHighlight({
      id: `hl_${Date.now()}`,
      bookId: book.id,
      chapterIndex: currentChapterIndex,
      startOffset: 0,
      endOffset: data.text.length,
      text: data.text,
      color: data.color,
      note: 'underline',
      createdAt: new Date().toISOString(),
    });
    const escapedText = data.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    webViewRef.current?.injectJavaScript(`
      (function() {
        window.__addHighlight && window.__addHighlight("${escapedText}", "transparent", "", "");
        var spans = document.querySelectorAll('.miyo-highlight');
        var last = spans[spans.length - 1];
        if (last) {
          last.style.backgroundColor = 'transparent';
          last.style.textDecoration = 'underline';
          last.style.textDecorationColor = '${data.color}';
          last.style.textUnderlineOffset = '3px';
        }
      })();
      true;
    `);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [book, currentChapterIndex]);

  const handleAddTerm = useCallback((text: string) => {
    setSelection(null);
    setAddTermInitialText(text);
    setShowAddTermModal(true);
  }, []);

  const handleDeleteBookmark = useCallback(async (bmId: string) => {
    await removeBookmark(bmId);
  }, [removeBookmark]);

  const handleDeleteHighlight = useCallback(async (hlId: string) => {
    await removeHighlight(hlId);
    webViewRef.current?.injectJavaScript(`
      (function() {
        var spans = document.querySelectorAll('.miyo-highlight[data-id="${hlId}"]');
        spans.forEach(function(span) {
          var parent = span.parentNode;
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
        });
      })();
      true;
    `);
  }, [removeHighlight]);

  const getMargins = () => {
    const base =
      screenWidth < 400
        ? screenWidth * 0.04
        : screenWidth < 600
          ? screenWidth * 0.06
          : Math.min(screenWidth * 0.1, Math.max(0, (screenWidth - 600) / 2));
    const mult =
      readingSettings.marginPreset === 'narrow' ? 0.55 : readingSettings.marginPreset === 'wide' ? 1.38 : 1;
    return Math.max(8, base * mult);
  };

  const margins = getMargins();
  const columnMaxPx = readingSettings.contentColumnWidth;
  const wrapInlineStyle = columnMaxPx
    ? `max-width:${columnMaxPx}px;margin-left:auto;margin-right:auto;width:100%;`
    : 'max-width:none;width:100%;';

  const generateReaderHTML = () => {
    if (!parsedEpub) {
      return `<!DOCTYPE html><html><body style="background:${currentTheme.background};color:${currentTheme.text};font-family:sans-serif;padding:40px;text-align:center;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p>Loading book...</p></body></html>`;
    }

    const fontStack = getFontStack(typography.fontFamily);
    const googleFontsLink = getGoogleFontsLink(typography.fontFamily);

    const chapter = parsedEpub.chapters[currentChapterIndex];
    if (!chapter) {
      return `<!DOCTYPE html><html><body style="background:${currentTheme.background};color:${currentTheme.text};font-family:sans-serif;padding:40px;"><p>Chapter not found</p></body></html>`;
    }

    const highlightsJSON = JSON.stringify(
      chapterHighlights.map(h => ({ text: h.text, color: h.color, textColor: h.textColor || null, id: h.id }))
    );

    const escapedSearchTerm = searchHighlightTerm
      ? searchHighlightTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\<')
      : '';

    const bionicInit = readingSettings.bionicReading
      ? `
      setTimeout(function miyoBionic() {
        try {
          var root = document.querySelector('.miyo-wrap') || document.body;
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
          var nodes = [];
          while (walker.nextNode()) nodes.push(walker.currentNode);
          var budget = 14000;
          for (var i = 0; i < nodes.length && budget > 0; i++) {
            var node = nodes[i];
            var p = node.parentElement;
            if (!p) continue;
            var tag = p.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') continue;
            if (p.closest('code,pre,script,style,.miyo-highlight,.miyo-search-match')) continue;
            var t = node.nodeValue;
            if (!t || t.replace(/\\s/g, '').length < 12) continue;
            var parts = t.split(/(\\s+)/);
            var frag = document.createDocumentFragment();
            for (var j = 0; j < parts.length; j++) {
              var w = parts[j];
              if (!w || /^\\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); continue; }
              if (w.length < 4) { frag.appendChild(document.createTextNode(w)); continue; }
              var c = Math.max(1, Math.ceil(w.length * 0.42));
              var s = document.createElement('strong');
              s.className = 'miyo-bionic';
              s.style.fontWeight = '650';
              s.textContent = w.slice(0, c);
              frag.appendChild(s);
              frag.appendChild(document.createTextNode(w.slice(c)));
              budget -= w.length;
            }
            node.parentNode.replaceChild(frag, node);
          }
        } catch (e) {}
      }, 520);
`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">${googleFontsLink}
  <style>
    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    :root {
      --bg: ${currentTheme.background};
      --fg: ${currentTheme.text};
      --fg2: ${currentTheme.secondaryText};
      --accent: ${currentTheme.accent};
      --card: ${currentTheme.cardBackground};
    }
    html {
      font-size: ${typography.fontSize}px;
      -webkit-text-size-adjust: 100%;
      /* blue light filter applied as native overlay */
    }
    body {
      font-family: ${fontStack};
      font-size: 1rem;
      font-weight: ${typography.fontWeight};
      line-height: ${typography.lineHeight};
      letter-spacing: ${typography.letterSpacing}em;
      color: var(--fg);
      background-color: var(--bg);
      padding: 20px ${margins}px 80px;
      text-align: ${typography.textAlign};
      word-wrap: break-word;
      overflow-wrap: break-word;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }
    .miyo-wrap { box-sizing: border-box; }
    .miyo-wrap.miyo-two-col {
      column-count: 2;
      column-gap: 1.35em;
      column-fill: balance;
    }
    @media (max-width: 520px) {
      .miyo-wrap.miyo-two-col { column-count: 1; }
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${fontStack};
      margin-top: 1.5em; margin-bottom: 0.75em;
      line-height: 1.3; color: var(--fg); font-weight: 700;
    }
    h1 { font-size: 1.5em; } h2 { font-size: 1.3em; } h3 { font-size: 1.15em; }
    p { margin-top: 0; margin-bottom: ${typography.paragraphSpacing}px; hyphens: auto; -webkit-hyphens: auto; }
    p:first-of-type { text-indent: 0; }
    img { max-width: 100%; height: auto; display: block; margin: 1.2em auto; border-radius: 6px; }
    figure { margin: 1em 0; text-align: center; }
    figcaption { font-size: 0.85em; color: var(--fg2); margin-top: 0.5em; font-style: italic; }
    a { color: var(--accent); text-decoration: none; }
    a:active { opacity: 0.7; }
    blockquote {
      border-left: 3px solid var(--accent); margin: 1.2em 0;
      padding: 0.6em 1.2em; color: var(--fg2); font-style: italic;
      border-radius: 0 8px 8px 0; background: color-mix(in srgb, var(--accent) 5%, transparent);
    }
    pre { background: var(--card); padding: 1em; border-radius: 8px; overflow-x: auto; font-size: 0.85em; }
    code { font-family: 'Courier New', monospace; font-size: 0.85em; background: var(--card); padding: 2px 6px; border-radius: 4px; }
    pre code { background: transparent; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
    th, td { padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--fg2) 30%, transparent); text-align: left; }
    th { background: var(--card); font-weight: 600; }
    hr { border: none; border-top: 1px solid color-mix(in srgb, var(--fg2) 25%, transparent); margin: 2em 0; }
    ::selection { background-color: color-mix(in srgb, var(--accent) 40%, transparent); }
    ::-moz-selection { background-color: color-mix(in srgb, var(--accent) 40%, transparent); }
    .miyo-highlight { border-radius: 3px; transition: opacity 0.2s; }
    .miyo-term-replaced { border-bottom: 1.5px dotted var(--accent); cursor: help; }
    .miyo-search-match { background-color: color-mix(in srgb, var(--accent) 50%, transparent); border-radius: 3px; outline: 2px solid color-mix(in srgb, var(--accent) 80%, transparent); }
    ${parsedEpub?.extractedCss || ''}
  </style>
</head>
<body>
  <div class="miyo-wrap${readingSettings.columnLayout === 'two' ? ' miyo-two-col' : ''}" style="${wrapInlineStyle}">
  ${(() => {
    let content = chapter.content;
    // Apply term replacements from term groups applied to this book
    if (book) {
      const replacements = getReplacementMap(book.id);
      if (replacements.size > 0) {
        // Sort by length descending so longer matches take priority
        const entries = Array.from(replacements.entries()).sort((a, b) => b[0].length - a[0].length);
        for (const [original, corrected] of entries) {
          const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'gi');
          content = content.replace(regex, `<span class="miyo-term-replaced" title="Original: ${original.replace(/"/g, '&quot;')}">${corrected}</span>`);
        }
      }
    }
    return content;
  })()}
  </div>
  <script>
    (function() {
      function notify(data) {
        try {
          var msg = JSON.stringify(data);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(msg);
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage(msg, '*');
          }
        } catch(e) {}
      }

      // Text selection tracking
      var selTimeout;
      document.addEventListener('selectionchange', function() {
        clearTimeout(selTimeout);
        selTimeout = setTimeout(function() {
          var sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) {
            var text = sel.toString().trim();
            var range = sel.getRangeAt(0);
            var rect = range.getBoundingClientRect();
            notify({ type: 'selection', text: text, x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
          } else if (!sel || sel.isCollapsed) {
            notify({ type: 'clearSelection' });
          }
        }, 80);
      });

      // Scroll tracking
      var scrollTimer;
      window.addEventListener('scroll', function() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function() {
          var scrollH = document.documentElement.scrollHeight - window.innerHeight;
          var pct = scrollH > 0 ? (window.scrollY / scrollH) * 100 : 0;
          notify({ type: 'scroll', scrollY: window.scrollY, scrollPercent: pct });
        }, 200);
      }, { passive: true });

      // Tap and Swipe zone tracking
      var touchStartX = 0, touchStartY = 0, touchStartTime = 0, touchMoved = false;
      document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
        touchMoved = false;
      }, { passive: true });
      document.addEventListener('touchmove', function() { touchMoved = true; }, { passive: true });
      document.addEventListener('touchend', function(e) {
        var touchEndX = e.changedTouches[0].screenX;
        var touchEndY = e.changedTouches[0].screenY;
        var dx = touchEndX - touchStartX;
        var dy = touchEndY - touchStartY;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);
        var duration = Date.now() - touchStartTime;

        // Skip if user was selecting text
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return;

        // Swipe detection (significant horizontal movement, minimal vertical, fast enough)
        if (absDx > 60 && absDy < 100 && duration < 500) {
          notify({ type: 'swipe', direction: dx > 0 ? 'right' : 'left' });
          return;
        }

        // Tap detection (minimal movement)
        if (!touchMoved || (absDx < 10 && absDy < 10)) {
          notify({ type: 'tap', x: e.changedTouches[0].clientX });
        }
      }, { passive: true });

      // Internal EPUB link interception — in-chapter #anchors scroll; others go to native
      document.addEventListener('click', function(e) {
        var a = e.target.closest ? e.target.closest('a') : null;
        if (!a) return;
        var rawHref = a.getAttribute('href') || '';
        if (!rawHref) return;
        if (rawHref.charAt(0) === '#') {
          e.preventDefault();
          var aid = decodeURIComponent(rawHref.slice(1));
          try {
            var el = document.getElementById(aid) || document.querySelector('[name="' + aid.replace(/"/g, '\\\\"') + '"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (err) {}
          return;
        }
        e.preventDefault();
        notify({ type: 'link', href: rawHref });
      });

      // Highlight helpers
      window.__addHighlight = function(text, bgColor, textColor, hlId) {
        try {
          if (!text) return;
          var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
          var found = false;
          while (walker.nextNode() && !found) {
            var node = walker.currentNode;
            var idx = node.textContent.indexOf(text);
            if (idx !== -1) {
              found = true;
              var range = document.createRange();
              range.setStart(node, idx); range.setEnd(node, idx + text.length);
              var span = document.createElement('span');
              span.style.backgroundColor = bgColor + '55';
              if (textColor) span.style.color = textColor;
              span.className = 'miyo-highlight';
              if (hlId) span.setAttribute('data-id', hlId);
              try { range.surroundContents(span); } catch(e) {}
            }
          }
        } catch(e) {}
      };

      // Apply saved highlights
      var savedHighlights = ${highlightsJSON};
      if (savedHighlights && savedHighlights.length > 0) {
        setTimeout(function() {
          savedHighlights.forEach(function(h) { window.__addHighlight(h.text, h.color, h.textColor, h.id); });
        }, 300);
      }

      // Search highlight
      window.__highlightSearch = function(term) {
        document.querySelectorAll('.miyo-search-match').forEach(function(el) {
          var parent = el.parentNode;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        });
        if (!term || term.length < 2) return;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var lowerTerm = term.toLowerCase();
        var firstMatch = null;
        while (walker.nextNode()) {
          var node = walker.currentNode;
          if (node.parentElement && node.parentElement.classList.contains('miyo-search-match')) continue;
          var idx2 = node.textContent.toLowerCase().indexOf(lowerTerm);
          if (idx2 !== -1) {
            var range2 = document.createRange();
            range2.setStart(node, idx2); range2.setEnd(node, idx2 + term.length);
            var mark = document.createElement('mark');
            mark.className = 'miyo-search-match';
            try { range2.surroundContents(mark); if (!firstMatch) firstMatch = mark; } catch(e) {}
            walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            if (firstMatch) break;
          }
        }
        if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      ${escapedSearchTerm ? `setTimeout(function() { window.__highlightSearch("${escapedSearchTerm}"); }, 500);` : ''}
      setTimeout(function() { window.scrollTo(0, ${lastScrollPosition}); }, 50);
      ${bionicInit}
    })();
  </script>
</body>
</html>`;
  };

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'selection') {
        setSelection({ text: data.text, x: data.x, y: data.y });
        setShowToolbar(false);
      } else if (data.type === 'clearSelection') {
        setSelection(null);
      } else if (data.type === 'tap') {
        if (!selection) handleTap(data.x);
      } else if (data.type === 'scroll') {
        if (data.scrollY !== undefined) {
          setLastScrollPosition(data.scrollY);
        }
        if (typeof data.scrollPercent === 'number' && !Number.isNaN(data.scrollPercent)) {
          setChapterScrollPercent(Math.min(100, Math.max(0, data.scrollPercent)));
        }
        scheduleScrollPersist();
      } else if (data.type === 'swipe') {
        if (readingSettings.tapZoneNavMode === 'chapter') {
          const total = parsedEpub?.chapters.length || 1;
          if (data.direction === 'left') {
            if (currentChapterIndex < total - 1) {
              setCurrentChapterIndex(prev => prev + 1);
              setChapterScrollPercent(0);
              setSearchHighlightTerm('');
              setLastScrollPosition(0);
            }
          } else if (data.direction === 'right') {
            if (currentChapterIndex > 0) {
              setCurrentChapterIndex(prev => prev - 1);
              setChapterScrollPercent(0);
              setSearchHighlightTerm('');
              setLastScrollPosition(0);
            }
          }
        } else {
          if (data.direction === 'left') injectScrollByPage('down');
          else injectScrollByPage('up');
        }
      } else if (data.type === 'link') {
        if (parsedEpub && data.href) {
          const rawHref: string = data.href;
          const hashI = rawHref.indexOf('#');
          const frag = hashI >= 0 ? decodeURIComponent(rawHref.slice(hashI + 1)) : '';
          const pathPart = hashI >= 0 ? rawHref.slice(0, hashI) : rawHref;

          if (!pathPart && frag) {
            const safe = JSON.stringify(frag);
            webViewRef.current?.injectJavaScript(`
              (function(){
                var id = ${safe};
                try {
                  var el = document.getElementById(id) || document.querySelector('[name="' + String(id).replace(/"/g, '\\\\"') + '"]');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (e) {}
              })();
              true;
            `);
            return;
          }

          const targetPath = pathPart;
          if (!targetPath) return;

          const currentChapter = parsedEpub.chapters[currentChapterIndex];
          const currentHref = currentChapter?.href || '';
          const currentDir = currentHref.includes('/')
            ? currentHref.substring(0, currentHref.lastIndexOf('/') + 1)
            : '';
          const pathParts = (currentDir + targetPath).split('/');
          const stack: string[] = [];
          for (const p of pathParts) {
            if (p === '..') stack.pop();
            else if (p !== '.' && p !== '') stack.push(p);
          }
          const resolvedPath = stack.join('/');
          const targetIdx = parsedEpub.chapters.findIndex(c =>
            c.href === resolvedPath ||
            c.href === targetPath ||
            c.href.endsWith('/' + resolvedPath) ||
            c.href.endsWith('/' + targetPath) ||
            c.href.split('/').pop() === targetPath.split('/').pop()
          );
          if (targetIdx !== -1) {
            if (frag) pendingChapterAnchorRef.current = frag;
            setCurrentChapterIndex(targetIdx);
            setSearchHighlightTerm('');
          }
        }
      }
    } catch (e) { }
  }, [
    handleTap,
    selection,
    parsedEpub,
    currentChapterIndex,
    readingSettings.tapZoneNavMode,
    injectScrollByPage,
    scheduleScrollPersist,
  ]);

  const currentChapter = parsedEpub?.chapters[currentChapterIndex];
  const totalChapters = parsedEpub?.chapters.length || 1;
  const bookProgressPct = useMemo(() => {
    if (!parsedEpub?.chapters.length) return 0;
    const n = parsedEpub.chapters.length;
    const seg = 100 / n;
    return Math.min(100, currentChapterIndex * seg + (seg * chapterScrollPercent) / 100);
  }, [parsedEpub, currentChapterIndex, chapterScrollPercent]);
  const progress = bookProgressPct;

  const chapterReadingMinutes = useMemo(() => {
    if (!currentChapter) return 0;
    return Math.max(1, Math.ceil(countChapterWords(currentChapter) / 200));
  }, [currentChapter]);

  const sleepMinutesLeft = useMemo(() => {
    if (sleepDeadlineMs == null) return null;
    return Math.max(0, Math.ceil((sleepDeadlineMs - Date.now()) / 60000));
  }, [sleepDeadlineMs, sleepUiTick]);

  const bookTotalWords = useMemo(() => {
    if (!parsedEpub) return 0;
    return parsedEpub.chapters.reduce((sum, ch) => sum + countChapterWords(ch), 0);
  }, [parsedEpub]);

  const wordsRemaining = useMemo(
    () => Math.max(0, bookTotalWords - estimatedWordsRead),
    [bookTotalWords, estimatedWordsRead]
  );

  const bookFinishEtaMinutes = useMemo(
    () => (wordsRemaining > 0 ? Math.max(1, Math.ceil(wordsRemaining / paceWpm)) : 0),
    [wordsRemaining, paceWpm]
  );

  const getChapterReadPercent = useCallback(
    (index: number) => {
      if (index < currentChapterIndex) return 100;
      if (index > currentChapterIndex) return 0;
      return Math.min(100, Math.max(0, Math.round(chapterScrollPercent)));
    },
    [currentChapterIndex, chapterScrollPercent]
  );

  const injectAutoScroll = useCallback(() => {
    const s = readingSettings.autoScrollSpeed;
    const js = `
(function(){
  if (window.__miyoScrollTimer) { clearInterval(window.__miyoScrollTimer); window.__miyoScrollTimer = null; }
  var speed = ${s};
  if (!speed) return;
  var step = 0.14 + speed * 0.11;
  window.__miyoScrollTimer = setInterval(function(){
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (window.scrollY >= maxScroll - 0.5) return;
    window.scrollBy(0, step);
  }, 45);
})();
true;
`;
    webViewRef.current?.injectJavaScript(js);
  }, [readingSettings.autoScrollSpeed]);

  useEffect(() => {
    injectAutoScroll();
  }, [injectAutoScroll]);

  const bookHighlights = book ? getHighlightsByBook(book.id) : [];
  const allBookmarks = book ? getBookmarksByBook(book.id) : [];
  const chapterTitles = parsedEpub?.chapters.map(c => c.title) || [];

  const handleExportAnnotationsTxt = useCallback(async () => {
    if (!book) return;
    const txt = annotationsToPlainText(book.title, allBookmarks, bookHighlights, chapterTitles);
    try {
      await Share.share({ message: txt, title: `${book.title} — annotations` });
    } catch {
      /* ignore */
    }
  }, [book, allBookmarks, bookHighlights, chapterTitles]);

  const handleExportAnnotationsMd = useCallback(async () => {
    if (!book) return;
    const md = annotationsToMarkdown(book.title, allBookmarks, bookHighlights, chapterTitles);
    try {
      await Share.share({ message: md, title: `${book.title} — annotations` });
    } catch {
      /* ignore */
    }
  }, [book, allBookmarks, bookHighlights, chapterTitles]);

  const readerHTML = useMemo(() => generateReaderHTML(), [
    parsedEpub,
    currentChapterIndex,
    chapterHighlights,
    searchHighlightTerm,
    lastScrollPosition,
    currentTheme.background,
    currentTheme.text,
    currentTheme.accent,
    currentTheme.secondaryText,
    currentTheme.cardBackground,
    typography.fontSize,
    typography.lineHeight,
    typography.letterSpacing,
    typography.fontFamily,
    typography.fontWeight,
    typography.textAlign,
    typography.paragraphSpacing,
    readingSettings.blueLightFilter,
    readingSettings.marginPreset,
    readingSettings.contentColumnWidth,
    readingSettings.bionicReading,
    readingSettings.columnLayout,
    screenWidth,
  ]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <StatusBar hidden={false} />
        <BookLoadingAnimation title={book?.title} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <StatusBar hidden={false} />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 60 }]}>
          <View style={[styles.errorIconBg, { backgroundColor: currentTheme.accent + '15' }]}>
            <ThemedText style={{ fontSize: 40 }}>📚</ThemedText>
          </View>
          <ThemedText variant="primary" size="header" weight="bold" style={styles.errorTitle}>
            Unable to Load Book
          </ThemedText>
          <ThemedText variant="secondary" size="body" style={styles.errorMessage}>
            {loadError}
          </ThemedText>
          <PressableScale
            onPress={() => router.back()}
            style={[styles.errorBackButton, { backgroundColor: currentTheme.accent }]}
          >
            <ChevronLeft size={18} color="#FFFFFF" />
            <ThemedText size="body" weight="semibold" style={{ color: '#FFFFFF' }}>
              Go Back
            </ThemedText>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (!book || !parsedEpub) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <View style={styles.loadingContainer}>
          <ThemedText variant="secondary">Book not found</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar hidden={readingSettings.immersiveMode && !showToolbar} translucent backgroundColor="transparent" />

      {/* WebView Reader */}
      <View style={styles.contentContainer}>
        <Animated.View
          key={`chapter-${currentChapterIndex}`}
          entering={FadeIn.duration(300)}
          style={{ flex: 1, backgroundColor: currentTheme.background, zIndex: 0 }}
        >
          <ReaderWebView
            ref={webViewRef}
            source={{ html: readerHTML }}
            style={[styles.webView, { backgroundColor: currentTheme.background }]}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            onMessage={handleWebViewMessage}
            onLoadEnd={injectAutoScroll}
            onError={(syntheticEvent) => {
              logger.error('WebView error', syntheticEvent.nativeEvent);
            }}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url && request.url.startsWith('http')) {
                Linking.openURL(request.url);
                return false;
              }
              return true;
            }}
            allowsLinkPreview={false}
            setSupportMultipleWindows={false}
            {...(Platform.OS === 'android' ? { overScrollMode: 'never' as const } : {})}
          />
        </Animated.View>

        {/* Blue light: warm overlay above WebView (stronger tint + explicit stack order) */}
        {readingSettings.blueLightFilter && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                zIndex: 8,
                elevation: 8,
                backgroundColor: 'rgba(255, 120, 40, 0.42)',
              },
            ]}
          />
        )}
      </View>

      {/* Selection Toolbar */}
      {selection && (
        <SelectionToolbar
          selection={selection}
          onClose={() => setSelection(null)}
          onHighlight={handleHighlight}
          onNote={handleNote}
          onCopy={handleCopy}
          onShare={handleShare}
          onDictionary={handleDictionary}
          onWikipedia={handleWikipedia}
          onTranslate={handleTranslate}
          onBookmarkSelection={handleBookmarkSelection}
          onUnderline={handleUnderline}
          onAddTerm={handleAddTerm}
        />
      )}

      {/* Reading Progress Bar (when toolbar hidden) */}
      {!selection && (
        <Animated.View
          style={[
            styles.progressContainer,
            progressAnimatedStyle,
            { bottom: insets.bottom + 14, pointerEvents: 'none' },
          ]}
        >
          <View style={[styles.progressTrack, { backgroundColor: currentTheme.secondaryText + '22' }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: currentTheme.accent },
              ]}
            />
          </View>
          <ThemedText variant="secondary" size="caption" style={styles.progressText}>
            {Math.round(bookProgressPct)}% · {currentChapterIndex + 1}/{totalChapters} · ~{chapterReadingMinutes}m
            {sleepMinutesLeft != null && sleepMinutesLeft > 0 ? ` · ${sleepMinutesLeft}m sleep` : ''}
          </ThemedText>
        </Animated.View>
      )}

      {/* Top Toolbar */}
      <Animated.View
        style={[styles.topToolbar, toolbarAnimatedStyle, { paddingTop: insets.top, pointerEvents: showToolbar ? 'auto' : 'none' }]}
      >
        <View style={[styles.toolbarBackground, { backgroundColor: currentTheme.background + 'F2' }]}>
          <View style={styles.toolbarContent}>
            <PressableScale onPress={handleBack} style={styles.toolbarButton}>
              <ChevronLeft size={24} color={currentTheme.text} strokeWidth={2} />
            </PressableScale>

            <View style={styles.toolbarTitleSection}>
              <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={1}>
                {currentChapter?.title || book.title}
              </ThemedText>
              <ThemedText variant="secondary" size="caption" numberOfLines={2}>
                {book.author}
                {bookFinishEtaMinutes > 0 && wordsRemaining > 500
                  ? ` · ~${bookFinishEtaMinutes} min left in book`
                  : ''}
              </ThemedText>
            </View>

            <PressableScale
              onPress={() => {
                const darkTheme = themes.find(t => t.id === 'night-mode');
                const lightTheme = themes.find(t => t.id === 'sepia-classic');
                if (currentTheme.isDark && lightTheme) {
                  setTheme(lightTheme);
                } else if (!currentTheme.isDark && darkTheme) {
                  setTheme(darkTheme);
                }
              }}
              style={styles.toolbarButton}
            >
              {currentTheme.isDark ? (
                <Sun size={20} color={currentTheme.text} strokeWidth={2} />
              ) : (
                <Moon size={20} color={currentTheme.text} strokeWidth={2} />
              )}
            </PressableScale>

            <PressableScale
              onPress={() => setShowStatsModal(true)}
              style={styles.toolbarButton}
            >
              <BarChart2 size={20} color={currentTheme.text} strokeWidth={2} />
            </PressableScale>

            <PressableScale onPress={handleToggleBookmark} style={styles.toolbarButton}>
              {isBookmarked ? (
                <BookmarkCheck size={22} color={currentTheme.accent} />
              ) : (
                <Bookmark size={22} color={currentTheme.text} />
              )}
            </PressableScale>
          </View>
        </View>
      </Animated.View>

      {/* Bottom Toolbar */}
      <Animated.View
        style={[styles.bottomToolbar, bottomToolbarAnimatedStyle, { paddingBottom: insets.bottom + 8, pointerEvents: showToolbar ? 'auto' : 'none' }]}
      >
        <View style={[styles.toolbarBackground, { backgroundColor: currentTheme.background + 'F2' }]}>
          <View style={styles.bottomToolbarInner}>
            {/* Chapter Progress Slider */}
            <View style={styles.sliderRow}>
              <ThemedText variant="secondary" size="caption" weight="semibold">
                {currentChapterIndex + 1}
              </ThemedText>
              <View style={[styles.sliderTrack, { backgroundColor: currentTheme.secondaryText + '22' }]}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${progress}%`, backgroundColor: currentTheme.accent },
                  ]}
                />
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      left: `${Math.min(Math.max(progress, 3), 97)}%`,
                      backgroundColor: currentTheme.accent,
                      borderColor: currentTheme.background,
                    },
                  ]}
                />
              </View>
              <ThemedText variant="secondary" size="caption" weight="semibold">
                {totalChapters}
              </ThemedText>
            </View>

            {/* Action Row (scrolls on narrow screens — Koodo-style dense tools) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionsRow}
            >
              <PressableScale
                onPress={() => { setShowChapterDrawer(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <List size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Chapters</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowSearchModal(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Search size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Search</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => navigateChapter('prev')}
                disabled={currentChapterIndex === 0}
                style={[styles.actionBtn, ...(currentChapterIndex === 0 ? [styles.disabledBtn] : [])]}
              >
                <ChevronLeft size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Prev</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => navigateChapter('next')}
                disabled={currentChapterIndex >= totalChapters - 1}
                style={[styles.actionBtn, ...(currentChapterIndex >= totalChapters - 1 ? [styles.disabledBtn] : [])]}
              >
                <ChevronRight size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Next</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowAnnotationsDrawer(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Layers size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Notes</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowLayoutPanel(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Columns size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Layout</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowTypographyPanel(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Type size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Font</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowThemePanel(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Palette size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Theme</ThemedText>
              </PressableScale>
            </ScrollView>
          </View>
        </View>
      </Animated.View>

      {/* Chapter Drawer */}
      {showChapterDrawer && (
        <>
          <Pressable style={styles.drawerOverlay} onPress={() => setShowChapterDrawer(false)} />
          <Animated.View
            entering={SlideInUp.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.chapterDrawer,
              {
                backgroundColor: currentTheme.cardBackground,
                paddingBottom: insets.bottom + 24,
              },
            ]}
          >
            <View style={[styles.drawerHandle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
            <View style={styles.drawerHeaderRow}>
              <View>
                <ThemedText variant="primary" size="header" weight="bold">Chapters</ThemedText>
                <ThemedText variant="secondary" size="caption">
                  {totalChapters} chapters · Chapter {currentChapterIndex + 1}
                </ThemedText>
              </View>
              <PressableScale onPress={() => setShowChapterDrawer(false)} style={styles.drawerCloseBtn}>
                <X size={20} color={currentTheme.secondaryText} />
              </PressableScale>
            </View>
            <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
              {parsedEpub.chapters.map((chapter, index) => {
                const isActive = currentChapterIndex === index;
                const readPct = getChapterReadPercent(index);
                const w = countChapterWords(chapter);
                return (
                  <PressableScale
                    key={chapter.id}
                    onPress={() => goToChapter(index)}
                    style={[
                      styles.chapterItem,
                      ...(isActive
                        ? [styles.chapterItemActive, { backgroundColor: currentTheme.accent + '14' }]
                        : []),
                    ]}
                  >
                    <View style={[
                      styles.chapterItemNumber,
                      { backgroundColor: isActive ? currentTheme.accent : currentTheme.secondaryText + '18' }
                    ]}>
                      <ThemedText
                        style={[
                          styles.chapterNumber,
                          { color: isActive ? '#FFFFFF' : currentTheme.secondaryText }
                        ]}
                      >
                        {index + 1}
                      </ThemedText>
                    </View>
                    <View style={styles.chapterItemBody}>
                      <ThemedText
                        variant={isActive ? 'accent' : 'primary'}
                        size="body"
                        weight={isActive ? 'semibold' : 'regular'}
                        numberOfLines={2}
                        style={styles.chapterTitle}
                      >
                        {chapter.title}
                      </ThemedText>
                      <ThemedText variant="secondary" size="caption" style={styles.chapterMeta}>
                        {w.toLocaleString()} words · {readPct}% read
                      </ThemedText>
                      <View style={[styles.chapterReadTrack, { backgroundColor: currentTheme.secondaryText + '22' }]}>
                        <View
                          style={[
                            styles.chapterReadFill,
                            { width: `${readPct}%`, backgroundColor: currentTheme.accent },
                          ]}
                        />
                      </View>
                    </View>
                    {isActive && (
                      <View style={[styles.activeChapterDot, { backgroundColor: currentTheme.accent }]} />
                    )}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* Typography Panel */}
      {showTypographyPanel && (
        <>
          <Pressable style={styles.drawerOverlay} onPress={() => setShowTypographyPanel(false)} />
          <Animated.View
            entering={SlideInUp.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.bottomPanel,
              { backgroundColor: currentTheme.cardBackground, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={[styles.drawerHandle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
            <View style={styles.drawerHeaderRow}>
              <ThemedText variant="primary" size="header" weight="bold">Typography</ThemedText>
              <PressableScale onPress={() => setShowTypographyPanel(false)}>
                <X size={20} color={currentTheme.secondaryText} />
              </PressableScale>
            </View>

            {/* Font Size */}
            <View style={styles.typographySection}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                FONT SIZE · {typography.fontSize}px
              </ThemedText>
              <View style={styles.typographyControls}>
                <PressableScale
                  onPress={() => setTypography({ fontSize: Math.max(12, typography.fontSize - 1) })}
                  style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                >
                  <ThemedText variant="primary" size="body" weight="bold">A−</ThemedText>
                </PressableScale>
                <View style={[styles.typographySlider, { backgroundColor: currentTheme.secondaryText + '18' }]}>
                  <View style={[styles.typographySliderFill, { width: `${((typography.fontSize - 12) / 16) * 100}%`, backgroundColor: currentTheme.accent }]} />
                </View>
                <PressableScale
                  onPress={() => setTypography({ fontSize: Math.min(28, typography.fontSize + 1) })}
                  style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                >
                  <ThemedText variant="primary" size="title" weight="bold">A+</ThemedText>
                </PressableScale>
              </View>
            </View>

            {/* Line Height */}
            <View style={styles.typographySection}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                LINE HEIGHT · {typography.lineHeight.toFixed(1)}
              </ThemedText>
              <View style={styles.typographyControls}>
                <PressableScale
                  onPress={() => setTypography({ lineHeight: Math.max(1.2, parseFloat((typography.lineHeight - 0.1).toFixed(1))) })}
                  style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                >
                  <Minus size={18} color={currentTheme.text} />
                </PressableScale>
                <View style={[styles.typographySlider, { backgroundColor: currentTheme.secondaryText + '18' }]}>
                  <View style={[styles.typographySliderFill, { width: `${((typography.lineHeight - 1.2) / 0.8) * 100}%`, backgroundColor: currentTheme.accent }]} />
                </View>
                <PressableScale
                  onPress={() => setTypography({ lineHeight: Math.min(2.0, parseFloat((typography.lineHeight + 0.1).toFixed(1))) })}
                  style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                >
                  <Plus size={18} color={currentTheme.text} />
                </PressableScale>
              </View>
            </View>

            {/* Paragraph Spacing */}
            <View style={styles.typographySection}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                PARAGRAPH SPACING · {typography.paragraphSpacing}px
              </ThemedText>
              <View style={styles.typographyControls}>
                <PressableScale
                  onPress={() => setTypography({ paragraphSpacing: Math.max(8, typography.paragraphSpacing - 2) })}
                  style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                >
                  <Minus size={18} color={currentTheme.text} />
                </PressableScale>
                <View style={[styles.typographySlider, { backgroundColor: currentTheme.secondaryText + '18' }]}>
                  <View style={[styles.typographySliderFill, { width: `${((typography.paragraphSpacing - 8) / 32) * 100}%`, backgroundColor: currentTheme.accent }]} />
                </View>
                <PressableScale
                  onPress={() => setTypography({ paragraphSpacing: Math.min(40, typography.paragraphSpacing + 2) })}
                  style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                >
                  <Plus size={18} color={currentTheme.text} />
                </PressableScale>
              </View>
            </View>

            {/* Font Family */}
            <View style={styles.typographySection}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                FONT FAMILY
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
                {fontOptions.map(font => {
                  const isActive = typography.fontFamily === font.value;
                  return (
                    <PressableScale
                      key={font.value}
                      onPress={() => setTypography({ fontFamily: font.value })}
                      style={[
                        styles.fontChip,
                        {
                          backgroundColor: isActive ? currentTheme.accent + '20' : currentTheme.background,
                          borderColor: isActive ? currentTheme.accent : currentTheme.secondaryText + '30',
                        },
                      ]}
                    >
                      <ThemedText
                        variant={isActive ? 'accent' : 'secondary'}
                        size="caption"
                        weight={isActive ? 'semibold' : 'regular'}
                        style={font.value !== 'System' ? { fontFamily: font.value } : undefined}
                      >
                        {font.label}
                      </ThemedText>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>

            {/* Font weight (body) */}
            <View style={styles.typographySection}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                FONT WEIGHT · {typography.fontWeight}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
                {([400, 500, 600, 700] as const).map(w => {
                  const isActive = typography.fontWeight === w;
                  return (
                    <PressableScale
                      key={w}
                      onPress={() => setTypography({ fontWeight: w })}
                      style={[
                        styles.fontChip,
                        {
                          backgroundColor: isActive ? currentTheme.accent + '20' : currentTheme.background,
                          borderColor: isActive ? currentTheme.accent : currentTheme.secondaryText + '30',
                        },
                      ]}
                    >
                      <ThemedText
                        variant={isActive ? 'accent' : 'secondary'}
                        size="caption"
                        weight={isActive ? 'semibold' : 'regular'}
                      >
                        {w === 400 ? 'Regular' : w === 500 ? 'Medium' : w === 600 ? 'Semibold' : 'Bold'}
                      </ThemedText>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>

            {/* Text Alignment */}
            <View style={styles.typographySection}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                TEXT ALIGNMENT
              </ThemedText>
              <View style={styles.alignmentRow}>
                {[
                  { align: 'left', Icon: AlignLeft, label: 'Left' },
                  { align: 'justify', Icon: AlignJustify, label: 'Justify' },
                ].map(({ align, Icon, label }) => (
                  <PressableScale
                    key={align}
                    onPress={() => setTypography({ textAlign: align as any })}
                    style={[
                      styles.alignmentBtn,
                      {
                        backgroundColor: typography.textAlign === align ? currentTheme.accent + '18' : currentTheme.background,
                        borderColor: typography.textAlign === align ? currentTheme.accent : 'transparent',
                      },
                    ]}
                  >
                    <Icon size={20} color={typography.textAlign === align ? currentTheme.accent : currentTheme.secondaryText} />
                    <ThemedText
                      variant={typography.textAlign === align ? 'accent' : 'secondary'}
                      size="caption"
                      weight="medium"
                    >
                      {label}
                    </ThemedText>
                  </PressableScale>
                ))}
              </View>
            </View>
          </Animated.View>
        </>
      )}

      {/* Theme Panel */}
      {showThemePanel && (
        <>
          <Pressable style={styles.drawerOverlay} onPress={() => setShowThemePanel(false)} />
          <Animated.View
            entering={SlideInUp.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.bottomPanel,
              { backgroundColor: currentTheme.cardBackground, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={[styles.drawerHandle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
            <View style={styles.drawerHeaderRow}>
              <ThemedText variant="primary" size="header" weight="bold">Reading Theme</ThemedText>
              <PressableScale onPress={() => setShowThemePanel(false)}>
                <X size={20} color={currentTheme.secondaryText} />
              </PressableScale>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScroll}>
              {themes.map((theme) => {
                const isActive = currentTheme.id === theme.id;
                return (
                  <PressableScale
                    key={theme.id}
                    onPress={() => { setTheme(theme); setShowThemePanel(false); }}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: theme.background,
                        borderWidth: isActive ? 2.5 : 1,
                        borderColor: isActive ? theme.accent : theme.text + '15',
                      },
                    ]}
                  >
                    <View style={[styles.themePreviewLine, { backgroundColor: theme.text + '55', top: 16 }]} />
                    <View style={[styles.themePreviewLine, { backgroundColor: theme.text + '35', width: '55%', top: 26 }]} />
                    <View style={[styles.themePreviewLine, { backgroundColor: theme.text + '45', width: '70%', top: 36 }]} />
                    <View style={[styles.themeAccentDot, { backgroundColor: theme.accent }]} />
                    {isActive && (
                      <View style={[styles.themeActiveCheck, { backgroundColor: theme.accent }]}>
                        <ThemedText style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>✓</ThemedText>
                      </View>
                    )}
                    <ThemedText style={[styles.themeLabel, { color: theme.text }]} numberOfLines={2}>
                      {theme.name}
                    </ThemedText>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* Search Modal */}
      <SearchInBookModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        chapters={parsedEpub.chapters}
        currentChapterIndex={currentChapterIndex}
        onGoToChapter={(index, term) => {
          goToChapter(index, term);
          setShowSearchModal(false);
        }}
      />

      {/* Annotations Drawer */}
      <AnnotationsDrawer
        visible={showAnnotationsDrawer}
        onClose={() => setShowAnnotationsDrawer(false)}
        bookTitle={book.title}
        bookmarks={allBookmarks}
        highlights={bookHighlights}
        currentChapterIndex={currentChapterIndex}
        onGoToChapter={(index) => { goToChapter(index); setShowAnnotationsDrawer(false); }}
        onDeleteBookmark={handleDeleteBookmark}
        onDeleteHighlight={handleDeleteHighlight}
        chapterTitles={chapterTitles}
        onExportTxt={handleExportAnnotationsTxt}
        onExportMarkdown={handleExportAnnotationsMd}
      />

      <ReaderLayoutPanel visible={showLayoutPanel} onClose={() => setShowLayoutPanel(false)} />

      {/* Reading Stats Modal */}
      <ReadingStatsModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        book={book}
        currentChapterIndex={currentChapterIndex}
        totalChapters={totalChapters}
        totalHighlights={bookHighlights.length}
        totalBookmarks={allBookmarks.length}
        estimatedWordsRead={estimatedWordsRead}
        bookTotalWords={bookTotalWords}
        wordsRemaining={wordsRemaining}
        bookFinishEtaMinutes={bookFinishEtaMinutes}
      />

      {/* Add Term Modal (from reader selection) */}
      <TranslationSheet
        visible={translationSheet.open}
        sourceText={translationSheet.text}
        onClose={() => setTranslationSheet({ open: false, text: '' })}
        advanced={readingSettings.autoTranslationMode === 'advanced'}
      />

      <AddTermModal
        visible={showAddTermModal}
        initialText={addTermInitialText}
        onClose={() => setShowAddTermModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorIconBg: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  errorTitle: { textAlign: 'center', marginBottom: 10 },
  errorMessage: { textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  errorBackButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  contentContainer: { flex: 1, position: 'relative' },
  webView: { flex: 1 },

  progressContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: { flex: 1, height: 3, borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1.5 },
  progressText: { minWidth: 40, textAlign: 'right', fontSize: 11 },

  // Top Toolbar
  topToolbar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  toolbarBackground: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 6,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  toolbarButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  toolbarTitleSection: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },

  // Bottom Toolbar
  bottomToolbar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
  bottomToolbarInner: { paddingHorizontal: 14, paddingTop: 12 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sliderTrack: { flex: 1, height: 4, borderRadius: 2, position: 'relative', overflow: 'visible' },
  sliderFill: { height: '100%', borderRadius: 2 },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4, paddingHorizontal: 4, gap: 4 },
  actionBtn: { alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, minWidth: 56 },
  actionLabel: { fontSize: 10, letterSpacing: 0.1 },
  disabledBtn: { opacity: 0.28 },

  // Chapter Drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)', zIndex: 200 },
  chapterDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: screenHeight * 0.72,
    zIndex: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  drawerHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  drawerCloseBtn: { padding: 4, marginTop: 2 },
  drawerScroll: { maxHeight: screenHeight * 0.48 },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
    gap: 10,
  },
  chapterItemActive: {},
  chapterItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chapterNumber: { fontSize: 12, fontWeight: '700' },
  chapterItemBody: { flex: 1, minWidth: 0, gap: 4 },
  chapterTitle: { fontSize: 14, lineHeight: 20 },
  chapterMeta: { fontSize: 11, opacity: 0.9 },
  chapterReadTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  chapterReadFill: { height: '100%', borderRadius: 2 },
  activeChapterDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },

  // Bottom Panel (Typography + Theme)
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    zIndex: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },

  // Typography Panel
  typographySection: { marginBottom: 18 },
  typographyLabel: { letterSpacing: 0.8, marginBottom: 10, fontSize: 11 },
  typographyControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typographyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  typographySlider: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  typographySliderFill: { height: '100%', borderRadius: 2 },
  alignmentRow: { flexDirection: 'row', gap: 10 },
  alignmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  fontChipsRow: { gap: 8, paddingBottom: 4 },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },

  // Theme Panel
  themeScroll: { gap: 12, paddingVertical: 8 },
  themeOption: {
    width: 90,
    height: 125,
    borderRadius: 16,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  themePreviewLine: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 1.5,
    left: 12,
    right: 12,
  },
  themeAccentDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 12, right: 12 },
  themeLabel: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  themeActiveCheck: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
