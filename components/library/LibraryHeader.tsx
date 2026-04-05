import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Animated as RNAnimated,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { SortOption, FilterOption } from '@/types/book';
import {
  Grid3X3,
  List,
  SlidersHorizontal,
  Search,
  X,
  Check,
  LayoutGrid,
} from 'lucide-react-native';

interface LibraryHeaderProps {
  onSearchChange?: (text: string) => void;
  searchQuery?: string;
}

const sortOptions: { value: SortOption; label: string; description: string }[] = [
  { value: 'recent', label: 'Recently Read', description: 'Last opened first' },
  { value: 'title', label: 'Title A–Z', description: 'Alphabetical order' },
  { value: 'author', label: 'Author A–Z', description: 'By author name' },
  { value: 'progress', label: 'Reading Progress', description: 'Most progress first' },
  { value: 'dateAdded', label: 'Date Added', description: 'Newest imports first' },
];

const filterOptions: { value: FilterOption; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: '#8B5CF6' },
  { value: 'unread', label: 'Unread', color: '#6B7280' },
  { value: 'reading', label: 'Reading', color: '#3B82F6' },
  { value: 'finished', label: 'Finished', color: '#22C55E' },
];

export function LibraryHeader({ onSearchChange, searchQuery = '' }: LibraryHeaderProps) {
  const { currentTheme } = useTheme();
  const {
    sortOption,
    setSortOption,
    filterOption,
    setFilterOption,
    viewMode,
    setViewMode,
    books,
    sortedAndFilteredBooks,
  } = useLibrary();
  const [showSortModal, setShowSortModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const currentSortLabel = sortOptions.find(s => s.value === sortOption)?.label || 'Sort';
  const currentFilter = filterOptions.find(f => f.value === filterOption);

  return (
    <>
      <View style={styles.container}>
        {/* Title Row */}
        {!showSearch ? (
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <ThemedText variant="primary" size="title" weight="bold">
                Library
              </ThemedText>
              <View style={[styles.bookCountBadge, { backgroundColor: currentTheme.accent + '20' }]}>
                <ThemedText variant="accent" size="caption" weight="semibold">
                  {sortedAndFilteredBooks.length}
                </ThemedText>
              </View>
            </View>
            <View style={styles.titleActions}>
              <PressableScale
                onPress={() => setShowSearch(true)}
                style={[styles.iconBtn, { backgroundColor: currentTheme.cardBackground }]}
              >
                <Search size={18} color={currentTheme.text} />
              </PressableScale>
              <PressableScale
                onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                style={[styles.iconBtn, { backgroundColor: currentTheme.cardBackground }]}
              >
                {viewMode === 'grid' ? (
                  <List size={18} color={currentTheme.text} />
                ) : (
                  <Grid3X3 size={18} color={currentTheme.text} />
                )}
              </PressableScale>
            </View>
          </View>
        ) : (
          <View style={styles.searchRow}>
            <View style={[styles.searchInput, { backgroundColor: currentTheme.cardBackground }]}>
              <Search size={16} color={currentTheme.secondaryText} />
              <TextInput
                style={[styles.searchTextInput, { color: currentTheme.text }]}
                placeholder="Search books, authors..."
                placeholderTextColor={currentTheme.secondaryText}
                value={searchQuery}
                onChangeText={onSearchChange}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <PressableScale onPress={() => onSearchChange?.('')}>
                  <X size={16} color={currentTheme.secondaryText} />
                </PressableScale>
              )}
            </View>
            <PressableScale
              onPress={() => {
                setShowSearch(false);
                onSearchChange?.('');
              }}
              style={styles.cancelBtn}
            >
              <ThemedText variant="accent" size="body" weight="medium">Cancel</ThemedText>
            </PressableScale>
          </View>
        )}

        {/* Filter Chips + Sort */}
        {!showSearch && (
          <View style={styles.controlsRow}>
            {/* Filter Chips */}
            <View style={styles.filterChips}>
              {filterOptions.map(option => (
                <PressableScale
                  key={option.value}
                  onPress={() => setFilterOption(option.value)}
                  style={[
                    styles.filterChip,
                    filterOption === option.value
                      ? { backgroundColor: option.color + '20', borderColor: option.color }
                      : { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '25' },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.filterChipText,
                      { color: filterOption === option.value ? option.color : currentTheme.secondaryText },
                    ]}
                  >
                    {option.label}
                  </ThemedText>
                </PressableScale>
              ))}
            </View>

            {/* Sort Button */}
            <PressableScale
              onPress={() => setShowSortModal(true)}
              style={[styles.sortBtn, { backgroundColor: currentTheme.cardBackground }]}
            >
              <SlidersHorizontal size={14} color={currentTheme.accent} />
            </PressableScale>
          </View>
        )}
      </View>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: currentTheme.cardBackground }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText variant="primary" size="header" weight="bold">Sort Books</ThemedText>
              <PressableScale onPress={() => setShowSortModal(false)} style={styles.modalCloseBtn}>
                <X size={22} color={currentTheme.secondaryText} />
              </PressableScale>
            </View>

            {sortOptions.map(option => (
              <PressableScale
                key={option.value}
                onPress={() => {
                  setSortOption(option.value);
                  setShowSortModal(false);
                }}
                style={[
                  styles.sortOptionRow,
                  ...(sortOption === option.value ? [{ backgroundColor: currentTheme.accent + '10' }] : []),
                ]}
              >
                <View style={styles.sortOptionInfo}>
                  <ThemedText
                    variant={sortOption === option.value ? 'accent' : 'primary'}
                    size="body"
                    weight={sortOption === option.value ? 'semibold' : 'regular'}
                  >
                    {option.label}
                  </ThemedText>
                  <ThemedText variant="secondary" size="caption">
                    {option.description}
                  </ThemedText>
                </View>
                {sortOption === option.value && (
                  <Check size={18} color={currentTheme.accent} />
                )}
              </PressableScale>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  titleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  sortOptionInfo: {
    gap: 2,
  },
});
