import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
  Platform,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, copyAsync, deleteAsync } from 'expo-file-system/legacy';
import {
  StorageAccessFramework,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { getStorageDirectory } from '@/utils/permissions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { FlashList } from '@shopify/flash-list';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { BookCard } from '@/components/library/BookCard';
import { EmptyLibrary } from '@/components/library/EmptyLibrary';
import { LibraryHeader } from '@/components/library/LibraryHeader';
import { BookActionModal } from '@/components/library/BookActionModal';
import { ImportSuccessModal } from '@/components/library/ImportSuccessModal';
import { Book } from '@/types/book';
import { Plus, BookOpen, FolderOpen } from 'lucide-react-native';
import { logger, captureError } from '@/utils/logger';
import { extractEpubMetadata, getEpubChapterCount } from '@/utils/epub-parser';

export default function LibraryScreen() {
  const { currentTheme } = useTheme();
  const {
    sortedAndFilteredBooks,
    viewMode,
    addBook,
    removeBook,
    updateBook,
    isLoading,
    setFilterOption,
  } = useLibrary();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [importSuccess, setImportSuccess] = useState<{ titles: string[]; failed: number } | null>(null);

  const gridColumns = screenWidth < 360 ? 2 : screenWidth < 480 ? 3 : screenWidth < 600 ? 3 : 4;
  const horizontalPadding = 16;
  const itemSpacing = 10;
  const availableWidth = screenWidth - (horizontalPadding * 2);
  const cardWidth = Math.floor((availableWidth - (itemSpacing * (gridColumns - 1))) / gridColumns);
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  // Search filter
  const displayedBooks = useMemo(() => {
    if (!searchQuery.trim()) return sortedAndFilteredBooks;
    const q = searchQuery.toLowerCase();
    return sortedAndFilteredBooks.filter(
      b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [sortedAndFilteredBooks, searchQuery]);

  const handleImportBooks = useCallback(async () => {
    try {
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/epub'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        setImporting(false);
        return;
      }

      const storageDirUri = await getStorageDirectory();
      const booksDir = `${documentDirectory || ''}Books/`;
      
      if (!storageDirUri || Platform.OS !== 'android') {
        const dirInfo = await getInfoAsync(booksDir);
        if (!dirInfo.exists) {
          await makeDirectoryAsync(booksDir, { intermediates: true });
        }
      }

      let successCount = 0;
      let failCount = 0;
      const importedTitles: string[] = [];

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        try {
          const safeFileName = (asset.name || `book_${Date.now()}_${i}.epub`)
            .replace(/[<>:"/\\|?*]/g, '_');
          let destPath;

          if (storageDirUri && Platform.OS === 'android') {
            try {
              // Create file in the SAF user-selected directory
              destPath = await StorageAccessFramework.createFileAsync(
                storageDirUri,
                safeFileName,
                'application/epub+zip'
              );
              // Read cached asset & write to new SAF document
              const contentBase64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
              await writeAsStringAsync(destPath, contentBase64, { encoding: EncodingType.Base64 });
            } catch (safError) {
              logger.error('SAF write failed, falling back to app storage', safError);
              const dirInfo = await getInfoAsync(booksDir);
              if (!dirInfo.exists) await makeDirectoryAsync(booksDir, { intermediates: true });
              destPath = `${booksDir}${safeFileName}`;
              await copyAsync({ from: asset.uri, to: destPath });
            }
          } else {
            destPath = `${booksDir}${safeFileName}`;
            // Copy file to permanent location
            await copyAsync({
              from: asset.uri,
              to: destPath,
            });
          }

          // Extract metadata (after interactions so UI stays responsive during import loop)
          let metadata;
          let chapterCount = 1;
          try {
            await new Promise<void>(resolve => {
              InteractionManager.runAfterInteractions(() => resolve());
            });
            [metadata, chapterCount] = await Promise.all([
              extractEpubMetadata(destPath),
              getEpubChapterCount(destPath),
            ]);
          } catch (e) {
            logger.warn('Metadata extraction failed, using filename', e);
            const cleanName = safeFileName.replace(/\.epub$/i, '').replace(/[_-]/g, ' ');
            metadata = {
              title: cleanName,
              author: 'Unknown Author',
              coverImageBase64: null,
              description: '',
              language: 'en',
              publisher: '',
              subjects: [],
              publishDate: '',
            };
          }

          const newBook: Book = {
            id: `book_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 11)}`,
            title: metadata.title || safeFileName.replace(/\.epub$/i, ''),
            author: metadata.author || 'Unknown Author',
            coverUri: metadata.coverImageBase64 || null,
            filePath: destPath,
            progress: 0,
            currentChapter: 0,
            totalChapters: chapterCount,
            lastReadAt: null,
            dateAdded: new Date().toISOString(),
            readingStatus: 'unread',
            tags: metadata.subjects?.slice(0, 3) || [],
          };

          await addBook(newBook);
          successCount++;
          importedTitles.push(newBook.title);
        } catch (err) {
          captureError('Import single book', err);
          failCount++;
        }
      }

      if (successCount > 0) {
        setFilterOption('all');
        setImportSuccess({ titles: importedTitles, failed: failCount });
        logger.info(`Imported ${successCount} books`);
      } else if (failCount > 0) {
        Alert.alert('Import Failed', 'Could not import the selected files. Make sure they are valid EPUB files.');
      }
    } catch (error) {
      captureError('Import Books', error);
      Alert.alert('Import Failed', 'Could not access the file picker. Please check permissions in Settings.');
    } finally {
      setImporting(false);
    }
  }, [addBook]);

  const handleBookPress = useCallback((book: Book) => {
    router.push(`/reader/${book.id}`);
  }, [router]);

  const handleBookLongPress = useCallback((book: Book) => {
    setSelectedBook(book);
    setShowActionModal(true);
  }, []);

  const handleDeleteBook = useCallback(async () => {
    if (!selectedBook) return;
    Alert.alert(
      'Remove Book',
      `Remove "${selectedBook.title}" from your library? The file will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAsync(selectedBook.filePath, { idempotent: true });
            } catch (error) {
              captureError('Delete Book File', error);
            }
            await removeBook(selectedBook.id);
            setShowActionModal(false);
            setSelectedBook(null);
          },
        },
      ]
    );
  }, [selectedBook, removeBook]);

  const handleToggleStatus = useCallback(async (status: 'unread' | 'reading' | 'finished') => {
    if (!selectedBook) return;
    await updateBook(selectedBook.id, { readingStatus: status });
    setSelectedBook(prev => prev ? { ...prev, readingStatus: status } : null);
  }, [selectedBook, updateBook]);

  const handleUpdateBookTags = useCallback(
    async (tags: string[]) => {
      if (!selectedBook) return;
      await updateBook(selectedBook.id, { tags });
      setSelectedBook(prev => (prev ? { ...prev, tags } : null));
    },
    [selectedBook, updateBook]
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: Book; index: number }) => {
      const isLastInRow = (index + 1) % gridColumns === 0;
      return (
        <View
          style={[
            styles.gridItemWrapper,
            { width: cardWidth },
            !isLastInRow && { marginRight: itemSpacing },
          ]}
        >
          <BookCard
            book={item}
            isGridView={true}
            cardWidth={cardWidth}
            onPress={() => handleBookPress(item)}
            onLongPress={() => handleBookLongPress(item)}
          />
        </View>
      );
    },
    [gridColumns, cardWidth, itemSpacing, handleBookPress, handleBookLongPress]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Book; index: number }) => (
      <View style={styles.listItemWrap}>
        <BookCard
          book={item}
          isGridView={false}
          onPress={() => handleBookPress(item)}
          onLongPress={() => handleBookLongPress(item)}
        />
      </View>
    ),
    [handleBookPress, handleBookLongPress]
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.accent} />
        <ThemedText variant="secondary" size="body" style={{ marginTop: 12 }}>
          Loading library...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <LibraryHeader
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
        />

        {displayedBooks.length === 0 && sortedAndFilteredBooks.length === 0 ? (
          <EmptyLibrary onImport={handleImportBooks} />
        ) : displayedBooks.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <View style={[styles.noResultsIcon, { backgroundColor: currentTheme.accent + '15' }]}>
              <BookOpen size={36} color={currentTheme.accent} />
            </View>
            <ThemedText variant="primary" size="header" weight="semibold">No books found</ThemedText>
            <ThemedText variant="secondary" size="body" style={{ textAlign: 'center', marginTop: 6 }}>
              Try a different search term or clear your filters.
            </ThemedText>
          </View>
        ) : (
          <View style={{ flex: 1, minHeight: 200, width: '100%' }}>
            <FlashList
              data={displayedBooks}
              renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
              keyExtractor={item => item.id}
              numColumns={viewMode === 'grid' ? gridColumns : 1}
              key={viewMode === 'grid' ? `grid-${gridColumns}-${screenWidth}` : 'list'}
              contentContainerStyle={[
                viewMode === 'grid' ? styles.gridContent : styles.listContent,
                { paddingBottom: tabBarHeight + 90 },
              ]}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* Floating Import Button — only show when library has books */}
        {sortedAndFilteredBooks.length > 0 && (
          <Animated.View
            style={[
              styles.fabContainer,
              { bottom: tabBarHeight + 16 },
            ]}
          >
            <PressableScale
              onPress={handleImportBooks}
              disabled={importing}
              style={[styles.fab, { backgroundColor: currentTheme.accent }]}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Plus size={22} color="#FFFFFF" />
                  <ThemedText style={styles.fabLabel}>Import</ThemedText>
                </>
              )}
            </PressableScale>
          </Animated.View>
        )}
      </View>

      <ImportSuccessModal
        visible={!!importSuccess}
        titles={importSuccess?.titles ?? []}
        failedCount={importSuccess?.failed ?? 0}
        onClose={() => setImportSuccess(null)}
      />

      <BookActionModal
        visible={showActionModal}
        book={selectedBook}
        onClose={() => {
          setShowActionModal(false);
          setSelectedBook(null);
        }}
        onDelete={handleDeleteBook}
        onToggleStatus={handleToggleStatus}
        onUpdateTags={handleUpdateBookTags}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  listContent: {
    paddingTop: 10,
  },
  listItemWrap: {
    marginBottom: 8,
  },
  gridItemWrapper: {
    marginBottom: 10,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  noResultsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
