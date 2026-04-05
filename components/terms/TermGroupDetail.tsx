import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useTerms } from '@/context/TermsContext';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { TermGroup, Term } from '@/types/terms';
import {
  X,
  Trash2,
  Plus,
  BookOpen,
  ArrowRight,
  Check,
  Edit3,
} from 'lucide-react-native';

interface TermGroupDetailProps {
  visible: boolean;
  groupId: string | null;
  onClose: () => void;
}

export function TermGroupDetail({ visible, groupId, onClose }: TermGroupDetailProps) {
  const { currentTheme } = useTheme();
  const { termGroups, updateGroup, addTerm, removeTerm, updateTerm, deleteGroup, applyGroupToBook, removeGroupFromBook } = useTerms();
  const { books } = useLibrary();

  const group = termGroups.find(g => g.id === groupId) ?? null;

  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState('');
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [newOriginal, setNewOriginal] = useState('');
  const [newCorrected, setNewCorrected] = useState('');
  const [newContext, setNewContext] = useState('');
  const [editTermId, setEditTermId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState('');
  const [editCorrected, setEditCorrected] = useState('');
  const [showBookSelector, setShowBookSelector] = useState(false);

  useEffect(() => {
    if (group) {
      setNameText(group.name);
    }
  }, [group?.name]);

  useEffect(() => {
    if (!visible) {
      setEditingName(false);
      setShowAddTerm(false);
      setEditTermId(null);
      setShowBookSelector(false);
    }
  }, [visible]);

  if (!visible || !group) return null;

  const isDark = currentTheme.isDark;

  const handleSaveName = async () => {
    if (nameText.trim()) {
      await updateGroup(group.id, { name: nameText.trim() });
    }
    setEditingName(false);
  };

  const handleAddTerm = async () => {
    if (!newOriginal.trim() || !newCorrected.trim()) {
      Alert.alert('Required', 'Both original and corrected text are required.');
      return;
    }
    await addTerm(group.id, newOriginal.trim(), newCorrected.trim(), newContext.trim() || undefined);
    setNewOriginal('');
    setNewCorrected('');
    setNewContext('');
    setShowAddTerm(false);
  };

  const handleSaveEditTerm = async () => {
    if (!editTermId) return;
    await updateTerm(group.id, editTermId, {
      originalText: editOriginal.trim(),
      correctedText: editCorrected.trim(),
    });
    setEditTermId(null);
  };

  const handleDeleteGroup = () => {
    Alert.alert('Delete Group', `Delete "${group.name}" and all its terms?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGroup(group.id);
          onClose();
        },
      },
    ]);
  };

  const handleToggleBook = async (bookId: string) => {
    if (group.appliedToBooks.includes(bookId)) {
      await removeGroupFromBook(group.id, bookId);
    } else {
      await applyGroupToBook(group.id, bookId);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: currentTheme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.secondaryText + '18' }]}>
          <PressableScale onPress={onClose}>
            <X size={24} color={currentTheme.secondaryText} />
          </PressableScale>

          <View style={styles.headerCenter}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={[styles.nameInput, { color: currentTheme.text, borderColor: currentTheme.accent }]}
                  value={nameText}
                  onChangeText={setNameText}
                  autoFocus
                  onBlur={handleSaveName}
                  onSubmitEditing={handleSaveName}
                />
                <PressableScale onPress={handleSaveName}>
                  <Check size={20} color={currentTheme.accent} />
                </PressableScale>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={styles.nameRow}>
                <ThemedText variant="primary" size="header" weight="bold" numberOfLines={1}>
                  {group.name}
                </ThemedText>
                <Edit3 size={14} color={currentTheme.secondaryText} />
              </Pressable>
            )}
          </View>

          <PressableScale onPress={handleDeleteGroup}>
            <Trash2 size={20} color="#EF4444" />
          </PressableScale>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Terms List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.sectionLabel}>
                TERMS ({group.terms.length})
              </ThemedText>
              <PressableScale
                onPress={() => setShowAddTerm(true)}
                style={[styles.addBtn, { backgroundColor: currentTheme.accent }]}
              >
                <Plus size={16} color="#FFFFFF" />
                <ThemedText style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add Term</ThemedText>
              </PressableScale>
            </View>

            {group.terms.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: currentTheme.cardBackground }]}>
                <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                  No terms yet. Tap "Add Term" or use the reader to add translation corrections.
                </ThemedText>
              </View>
            ) : (
              group.terms.map((term) => {
                const isEditing = editTermId === term.id;
                return (
                  <View
                    key={term.id}
                    style={[styles.termCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '12' }]}
                  >
                    {isEditing ? (
                      <View style={styles.termEditContainer}>
                        <TextInput
                          style={[styles.termEditInput, { color: currentTheme.text, borderColor: currentTheme.secondaryText + '30' }]}
                          value={editOriginal}
                          onChangeText={setEditOriginal}
                          placeholder="Original text"
                          placeholderTextColor={currentTheme.secondaryText + '60'}
                        />
                        <ArrowRight size={16} color={currentTheme.accent} />
                        <TextInput
                          style={[styles.termEditInput, { color: currentTheme.text, borderColor: currentTheme.secondaryText + '30' }]}
                          value={editCorrected}
                          onChangeText={setEditCorrected}
                          placeholder="Corrected text"
                          placeholderTextColor={currentTheme.secondaryText + '60'}
                        />
                        <PressableScale onPress={handleSaveEditTerm}>
                          <Check size={20} color={currentTheme.accent} />
                        </PressableScale>
                        <PressableScale onPress={() => setEditTermId(null)}>
                          <X size={18} color={currentTheme.secondaryText} />
                        </PressableScale>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setEditTermId(term.id);
                          setEditOriginal(term.originalText);
                          setEditCorrected(term.correctedText);
                        }}
                        style={styles.termRow}
                      >
                        <View style={styles.termTextCol}>
                          <ThemedText variant="primary" size="body" numberOfLines={2}>
                            {term.originalText}
                          </ThemedText>
                          {term.context ? (
                            <ThemedText variant="secondary" size="caption" numberOfLines={1} style={{ marginTop: 2 }}>
                              {term.context}
                            </ThemedText>
                          ) : null}
                        </View>
                        <ArrowRight size={14} color={currentTheme.secondaryText} style={{ marginHorizontal: 8 }} />
                        <View style={styles.termTextCol}>
                          <ThemedText variant="accent" size="body" weight="semibold" numberOfLines={2}>
                            {term.correctedText}
                          </ThemedText>
                        </View>
                        <PressableScale
                          onPress={() => {
                            Alert.alert('Delete Term', 'Remove this term?', [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => removeTerm(group.id, term.id) },
                            ]);
                          }}
                          style={styles.deleteTermBtn}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </PressableScale>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Applied Books */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.sectionLabel}>
                APPLIED TO BOOKS ({group.appliedToBooks.length})
              </ThemedText>
              <PressableScale
                onPress={() => setShowBookSelector(!showBookSelector)}
                style={[styles.addBtn, { backgroundColor: currentTheme.accent + '20' }]}
              >
                <BookOpen size={16} color={currentTheme.accent} />
                <ThemedText variant="accent" size="caption" weight="semibold">
                  {showBookSelector ? 'Done' : 'Manage'}
                </ThemedText>
              </PressableScale>
            </View>

            {showBookSelector ? (
              books.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: currentTheme.cardBackground }]}>
                  <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                    No books in your library yet.
                  </ThemedText>
                </View>
              ) : (
                books.map((book) => {
                  const isApplied = group.appliedToBooks.includes(book.id);
                  return (
                    <PressableScale
                      key={book.id}
                      onPress={() => handleToggleBook(book.id)}
                      style={[
                        styles.bookItem,
                        {
                          backgroundColor: isApplied ? currentTheme.accent + '12' : currentTheme.cardBackground,
                          borderColor: isApplied ? currentTheme.accent + '40' : currentTheme.secondaryText + '12',
                        },
                      ]}
                    >
                      <ThemedText
                        variant={isApplied ? 'accent' : 'primary'}
                        size="body"
                        weight={isApplied ? 'semibold' : 'regular'}
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {book.title}
                      </ThemedText>
                      {isApplied && <Check size={18} color={currentTheme.accent} />}
                    </PressableScale>
                  );
                })
              )
            ) : (
              group.appliedToBooks.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: currentTheme.cardBackground }]}>
                  <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                    Not applied to any books. Tap "Manage" to link this group.
                  </ThemedText>
                </View>
              ) : (
                group.appliedToBooks.map((bookId) => {
                  const book = books.find(b => b.id === bookId);
                  return (
                    <View key={bookId} style={[styles.bookItem, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '12' }]}>
                      <ThemedText variant="primary" size="body" numberOfLines={1} style={{ flex: 1 }}>
                        {book?.title ?? 'Unknown Book'}
                      </ThemedText>
                      <ThemedText variant="secondary" size="caption">Active</ThemedText>
                    </View>
                  );
                })
              )
            )}
          </View>
        </ScrollView>

        {/* Add Term Inline */}
        {showAddTerm && (
          <Animated.View
            entering={SlideInUp.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.addTermPanel, { backgroundColor: currentTheme.cardBackground, borderTopColor: currentTheme.secondaryText + '18' }]}
          >
            <View style={styles.addTermHeader}>
              <ThemedText variant="primary" size="body" weight="semibold">Add Term</ThemedText>
              <PressableScale onPress={() => setShowAddTerm(false)}>
                <X size={20} color={currentTheme.secondaryText} />
              </PressableScale>
            </View>
            <TextInput
              style={[styles.addTermInput, { color: currentTheme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: currentTheme.secondaryText + '25' }]}
              placeholder="Original text (as it appears in the novel)"
              placeholderTextColor={currentTheme.secondaryText + '80'}
              value={newOriginal}
              onChangeText={setNewOriginal}
            />
            <TextInput
              style={[styles.addTermInput, { color: currentTheme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: currentTheme.secondaryText + '25' }]}
              placeholder="Corrected translation"
              placeholderTextColor={currentTheme.secondaryText + '80'}
              value={newCorrected}
              onChangeText={setNewCorrected}
            />
            <TextInput
              style={[styles.addTermInput, { color: currentTheme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: currentTheme.secondaryText + '25' }]}
              placeholder="Context (optional)"
              placeholderTextColor={currentTheme.secondaryText + '80'}
              value={newContext}
              onChangeText={setNewContext}
            />
            <PressableScale
              onPress={handleAddTerm}
              style={[styles.addTermConfirm, { backgroundColor: currentTheme.accent }]}
            >
              <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Save Term</ThemedText>
            </PressableScale>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerCenter: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingVertical: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: { letterSpacing: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  termCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  termTextCol: { flex: 1 },
  termEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  termEditInput: {
    flex: 1,
    fontSize: 14,
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  deleteTermBtn: {
    padding: 6,
    marginLeft: 4,
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  addTermPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: 16,
    gap: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  addTermHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  addTermInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
  },
  addTermConfirm: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
});
