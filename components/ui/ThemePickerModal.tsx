import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { Theme } from '@/types/theme';
import { X, Check, Palette } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ThemePickerModal({ visible, onClose }: ThemePickerModalProps) {
  const { currentTheme, setTheme, themes } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = Math.min(120, (screenWidth - 64) / 3);

  const handleThemeSelect = (theme: Theme) => {
    setTheme(theme);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: currentTheme.background },
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: currentTheme.secondaryText + '15' },
          ]}
        >
          <View style={styles.headerLeft}>
            <Palette size={22} color={currentTheme.accent} />
            <ThemedText variant="primary" size="header" weight="bold">
              Themes
            </ThemedText>
          </View>
          <PressableScale
            onPress={onClose}
            style={[
              styles.closeButton,
              { backgroundColor: currentTheme.secondaryText + '15' },
            ]}
          >
            <X size={20} color={currentTheme.text} />
          </PressableScale>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText variant="secondary" size="body" style={styles.subtitle}>
            Choose a reading theme that suits your mood
          </ThemedText>

          {/* Theme Grid */}
          <View style={styles.grid}>
            {themes.map(theme => {
              const isSelected = currentTheme.id === theme.id;
              return (
                <PressableScale
                  key={theme.id}
                  onPress={() => handleThemeSelect(theme)}
                  style={[
                    styles.themeCard,
                    {
                      width: cardWidth,
                      backgroundColor: theme.cardBackground,
                      borderColor: isSelected ? theme.accent : 'transparent',
                      borderWidth: isSelected ? 2.5 : 0,
                    },
                  ]}
                >
                  {/* Preview */}
                  <View style={[styles.preview, { backgroundColor: theme.background }]}>
                    <View style={[styles.previewTitle, { backgroundColor: theme.text }]} />
                    <View style={[styles.previewLine1, { backgroundColor: theme.text + '60' }]} />
                    <View style={[styles.previewLine2, { backgroundColor: theme.text + '40' }]} />
                    <View style={[styles.previewAccent, { backgroundColor: theme.accent }]} />

                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: theme.accent }]}>
                        <Check size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </View>

                  {/* Name */}
                  <View style={styles.themeFooter}>
                    <ThemedText
                      size="caption"
                      weight={isSelected ? 'semibold' : 'medium'}
                      numberOfLines={1}
                      style={{ color: theme.text }}
                    >
                      {theme.name}
                    </ThemedText>
                  </View>

                  {/* Color dots */}
                  <View style={styles.colorDots}>
                    <View style={[styles.dot, { backgroundColor: theme.background, borderColor: theme.text + '30' }]} />
                    <View style={[styles.dot, { backgroundColor: theme.text, borderColor: theme.text + '30' }]} />
                    <View style={[styles.dot, { backgroundColor: theme.accent, borderColor: theme.text + '30' }]} />
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {/* Current Theme Preview */}
          <View style={styles.previewSection}>
            <ThemedText
              variant="secondary"
              size="caption"
              weight="medium"
              style={styles.previewLabel}
            >
              CURRENT THEME PREVIEW
            </ThemedText>
            <View
              style={[
                styles.livePreview,
                { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '20' },
              ]}
            >
              <ThemedText variant="primary" size="header" weight="bold">
                {currentTheme.name}
              </ThemedText>
              <ThemedText variant="primary" size="body" style={{ marginTop: 8 }}>
                The quick brown fox jumps over the lazy dog.
              </ThemedText>
              <ThemedText variant="secondary" size="caption" style={{ marginTop: 4 }}>
                Secondary text appears like this.
              </ThemedText>
              <View style={styles.liveAccentRow}>
                <View style={[styles.liveAccentBar, { backgroundColor: currentTheme.accent }]} />
                <ThemedText variant="accent" size="caption" weight="semibold">
                  Accent Color
                </ThemedText>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  subtitle: {
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeCard: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  preview: {
    height: 72,
    padding: 10,
    position: 'relative',
  },
  previewTitle: {
    width: '50%',
    height: 5,
    borderRadius: 2.5,
    marginBottom: 6,
  },
  previewLine1: {
    width: '85%',
    height: 3,
    borderRadius: 1.5,
    marginBottom: 4,
  },
  previewLine2: {
    width: '65%',
    height: 3,
    borderRadius: 1.5,
    marginBottom: 8,
  },
  previewAccent: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeFooter: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  colorDots: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  previewSection: {
    marginTop: 24,
  },
  previewLabel: {
    letterSpacing: 1,
    marginBottom: 10,
  },
  livePreview: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  liveAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  liveAccentBar: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
});
