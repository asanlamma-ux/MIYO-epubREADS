import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInfoAsync } from 'expo-file-system/legacy';
import { Book, SortOption, FilterOption, ViewMode, ReadingPosition, Bookmark, Highlight } from '@/types/book';
import { logger, captureError } from '@/utils/logger';

interface LibraryContextType {
  books: Book[];
  addBook: (book: Book) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  updateBook: (bookId: string, updates: Partial<Book>) => Promise<void>;
  getBook: (bookId: string) => Book | undefined;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  filterOption: FilterOption;
  setFilterOption: (option: FilterOption) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortedAndFilteredBooks: Book[];
  isLoading: boolean;
  // Reading position
  saveReadingPosition: (position: ReadingPosition) => Promise<void>;
  getReadingPosition: (bookId: string) => Promise<ReadingPosition | null>;
  // Bookmarks
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Bookmark) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  getBookmarksByBook: (bookId: string) => Bookmark[];
  // Highlights
  highlights: Highlight[];
  addHighlight: (highlight: Highlight) => Promise<void>;
  removeHighlight: (highlightId: string) => Promise<void>;
  getHighlightsByBook: (bookId: string) => Highlight[];
  // Data management
  clearCache: () => Promise<void>;
  rescanLibrary: () => Promise<{ removed: number; valid: number }>;
  /** Sum of on-disk EPUB file sizes (bytes); best-effort */
  estimateLibraryStorageBytes: () => Promise<number>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const LIBRARY_STORAGE_KEY = '@miyo/library';
const SORT_STORAGE_KEY = '@miyo/sort';
const FILTER_STORAGE_KEY = '@miyo/filter';
const VIEW_MODE_STORAGE_KEY = '@miyo/view-mode';
const READING_POSITIONS_KEY = '@miyo/reading-positions';
const BOOKMARKS_KEY = '@miyo/bookmarks';
const HIGHLIGHTS_KEY = '@miyo/highlights';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [sortOption, setSortOptionState] = useState<SortOption>('recent');
  const [filterOption, setFilterOptionState] = useState<FilterOption>('all');
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [readingPositions, setReadingPositions] = useState<Record<string, ReadingPosition>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [
        libraryJson,
        sortJson,
        filterJson,
        viewModeJson,
        positionsJson,
        bookmarksJson,
        highlightsJson,
      ] = await Promise.all([
        AsyncStorage.getItem(LIBRARY_STORAGE_KEY),
        AsyncStorage.getItem(SORT_STORAGE_KEY),
        AsyncStorage.getItem(FILTER_STORAGE_KEY),
        AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY),
        AsyncStorage.getItem(READING_POSITIONS_KEY),
        AsyncStorage.getItem(BOOKMARKS_KEY),
        AsyncStorage.getItem(HIGHLIGHTS_KEY),
      ]);

      if (libraryJson) setBooks(JSON.parse(libraryJson));
      if (sortJson) setSortOptionState(sortJson as SortOption);
      if (filterJson) setFilterOptionState(filterJson as FilterOption);
      if (viewModeJson) setViewModeState(viewModeJson as ViewMode);
      if (positionsJson) setReadingPositions(JSON.parse(positionsJson));
      if (bookmarksJson) setBookmarks(JSON.parse(bookmarksJson));
      if (highlightsJson) setHighlights(JSON.parse(highlightsJson));
      
      logger.info('Library data loaded successfully', { bookCount: libraryJson ? JSON.parse(libraryJson).length : 0 });
    } catch (error) {
      captureError('Load Library Data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBooks = async (newBooks: Book[]) => {
    try {
      await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(newBooks));
      logger.debug('Library saved', { bookCount: newBooks.length });
    } catch (error) {
      captureError('Save Library', error);
    }
  };

  const addBook = async (book: Book) => {
    const newBooks = [...books, book];
    setBooks(newBooks);
    await saveBooks(newBooks);
  };

  const removeBook = async (bookId: string) => {
    const newBooks = books.filter((b: Book) => b.id !== bookId);
    setBooks(newBooks);
    await saveBooks(newBooks);
  };

  const updateBook = async (bookId: string, updates: Partial<Book>) => {
    const newBooks = books.map((b: Book) => (b.id === bookId ? { ...b, ...updates } : b));
    setBooks(newBooks);
    await saveBooks(newBooks);
  };

  const getBook = (bookId: string) => books.find((b: Book) => b.id === bookId);

  const setSortOption = async (option: SortOption) => {
    setSortOptionState(option);
    try {
      await AsyncStorage.setItem(SORT_STORAGE_KEY, option);
    } catch (error) {
      captureError('Save Sort Option', error);
    }
  };

  const setFilterOption = async (option: FilterOption) => {
    setFilterOptionState(option);
    try {
      await AsyncStorage.setItem(FILTER_STORAGE_KEY, option);
    } catch (error) {
      captureError('Save Filter Option', error);
    }
  };

  const setViewMode = async (mode: ViewMode) => {
    setViewModeState(mode);
    try {
      await AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch (error) {
      captureError('Save View Mode', error);
    }
  };

  const sortedAndFilteredBooks = React.useMemo(() => {
    let filtered = books;

    // Apply filter
    if (filterOption !== 'all') {
      filtered = books.filter((b: Book) => b.readingStatus === filterOption);
    }

    // Apply sort
    const sorted = [...filtered];
    switch (sortOption) {
      case 'recent':
        sorted.sort((a, b) => {
          const dateA = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
          const dateB = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        sorted.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'progress':
        sorted.sort((a, b) => b.progress - a.progress);
        break;
      case 'dateAdded':
        sorted.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
        break;
    }

    return sorted;
  }, [books, sortOption, filterOption]);

  // Reading positions
  const saveReadingPosition = async (position: ReadingPosition) => {
    const newPositions = { ...readingPositions, [position.bookId]: position };
    setReadingPositions(newPositions);
    try {
      await AsyncStorage.setItem(READING_POSITIONS_KEY, JSON.stringify(newPositions));
    } catch (error) {
      captureError('Save Reading Position', error);
    }
  };

  const getReadingPosition = async (bookId: string) => {
    return readingPositions[bookId] || null;
  };

  // Bookmarks
  const addBookmark = async (bookmark: Bookmark) => {
    const newBookmarks = [...bookmarks, bookmark];
    setBookmarks(newBookmarks);
    try {
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(newBookmarks));
    } catch (error) {
      captureError('Save Bookmark', error);
    }
  };

  const removeBookmark = async (bookmarkId: string) => {
    const newBookmarks = bookmarks.filter((b: Bookmark) => b.id !== bookmarkId);
    setBookmarks(newBookmarks);
    try {
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(newBookmarks));
    } catch (error) {
      captureError('Remove Bookmark', error);
    }
  };

  const getBookmarksByBook = (bookId: string) => bookmarks.filter((b: Bookmark) => b.bookId === bookId);

  // Highlights
  const addHighlight = async (highlight: Highlight) => {
    const newHighlights = [...highlights, highlight];
    setHighlights(newHighlights);
    try {
      await AsyncStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(newHighlights));
    } catch (error) {
      captureError('Save Highlight', error);
    }
  };

  const removeHighlight = async (highlightId: string) => {
    const newHighlights = highlights.filter((h: Highlight) => h.id !== highlightId);
    setHighlights(newHighlights);
    try {
      await AsyncStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(newHighlights));
    } catch (error) {
      captureError('Remove Highlight', error);
    }
  };

  const getHighlightsByBook = (bookId: string) => highlights.filter((h: Highlight) => h.bookId === bookId);

  // Data management
  const clearCache = async () => {
    try {
      setReadingPositions({});
      setBookmarks([]);
      setHighlights([]);
      await AsyncStorage.multiRemove([READING_POSITIONS_KEY, BOOKMARKS_KEY, HIGHLIGHTS_KEY]);
      logger.info('Cache cleared successfully');
    } catch (error) {
      captureError('Clear Cache', error);
    }
  };

  const estimateLibraryStorageBytes = async (): Promise<number> => {
    let total = 0;
    for (const book of books) {
      try {
        const info = await getInfoAsync(book.filePath);
        if (info.exists && 'size' in info) {
          total += (info as { size: number }).size;
        }
      } catch {
        /* skip */
      }
    }
    return total;
  };

  const rescanLibrary = async (): Promise<{ removed: number; valid: number }> => {
    try {
      let removed = 0;
      let valid = 0;
      const booksToRemove: string[] = [];

      for (const book of books) {
        try {
          const info = await getInfoAsync(book.filePath);
          if (!info.exists) {
            booksToRemove.push(book.id);
            removed++;
          } else {
            valid++;
          }
        } catch {
          // If we can't check, assume it's valid
          valid++;
        }
      }

      // Remove orphaned books
      if (booksToRemove.length > 0) {
        const newBooks = books.filter((b: Book) => !booksToRemove.includes(b.id));
        setBooks(newBooks);
        await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(newBooks));
      }

      logger.info('Library rescan complete', { removed, valid });
      return { removed, valid };
    } catch (error) {
      captureError('Rescan Library', error);
      return { removed: 0, valid: books.length };
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        books,
        addBook,
        removeBook,
        updateBook,
        getBook,
        sortOption,
        setSortOption,
        filterOption,
        setFilterOption,
        viewMode,
        setViewMode,
        sortedAndFilteredBooks,
        isLoading,
        saveReadingPosition,
        getReadingPosition,
        bookmarks,
        addBookmark,
        removeBookmark,
        getBookmarksByBook,
        highlights,
        addHighlight,
        removeHighlight,
        getHighlightsByBook,
        clearCache,
        rescanLibrary,
        estimateLibraryStorageBytes,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (context === undefined) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
