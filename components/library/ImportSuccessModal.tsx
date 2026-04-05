import React from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CheckCircle2, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';

type Props = {
  visible: boolean;
  titles: string[];
  failedCount?: number;
  onClose: () => void;
};

export function ImportSuccessModal({ visible, titles, failedCount = 0, onClose }: Props) {
  const { currentTheme } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.center}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(160)}
          style={[
            styles.card,
            {
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.secondaryText + '22',
            },
          ]}
        >
          <PressableScale onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={currentTheme.secondaryText} />
          </PressableScale>

          <View style={[styles.iconWrap, { backgroundColor: currentTheme.accent + '18' }]}>
            <CheckCircle2 size={40} color={currentTheme.accent} strokeWidth={2} />
          </View>

          <ThemedText variant="primary" size="header" weight="bold" style={styles.title}>
            Import complete
          </ThemedText>
          <ThemedText variant="secondary" size="body" style={styles.subtitle}>
            {titles.length === 1
              ? 'Your book is in the library.'
              : `${titles.length} books added to your library.`}
            {failedCount > 0 ? ` ${failedCount} file(s) could not be imported.` : ''}
          </ThemedText>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {titles.map((t, i) => (
              <View
                key={`${t}-${i}`}
                style={[styles.listRow, { borderBottomColor: currentTheme.secondaryText + '15' }]}
              >
                <ThemedText variant="primary" size="body" numberOfLines={2}>
                  {t}
                </ThemedText>
              </View>
            ))}
          </ScrollView>

          <PressableScale
            onPress={onClose}
            style={[styles.primaryBtn, { backgroundColor: currentTheme.accent }]}
          >
            <ThemedText style={styles.primaryBtnText}>Done</ThemedText>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    maxHeight: Platform.OS === 'web' ? '80%' : '75%',
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, zIndex: 2, padding: 6 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  list: { maxHeight: 220, marginBottom: 16 },
  listRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
