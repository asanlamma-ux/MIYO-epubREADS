import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  LinearTransition,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { ThemeCard } from '@/components/themes/ThemeCard';
import { Theme, defaultThemes } from '@/types/theme';
import { Plus, X, Check } from 'lucide-react-native';

const colorPresets = [
  '#F4EFE8', '#1A1A1A', '#E8F0E8', '#F0EBF4', '#000000', '#FFFBF5',
  '#F5F5F5', '#E8F1F5', '#FFF5ED', '#1E2430', '#FDF2F4', '#1C1816',
  '#3A3228', '#E8E6E3', '#2D3E2D', '#3E3548', '#CCCCCC', '#2C2416',
  '#8B6F47', '#A78BFA', '#4A7C59', '#9B7EBD', '#00D9FF', '#9D7651',
  '#666666', '#2D7D9A', '#D97706', '#88C0D0', '#D4687A', '#C4A77D',
];

export default function ThemesScreen() {
  const { currentTheme, setTheme, themes, addCustomTheme, removeCustomTheme } =
    useTheme();
  const insets = useSafeAreaInsets();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTheme, setNewTheme] = useState<Partial<Theme>>({
    name: '',
    background: '#F4EFE8',
    text: '#3A3228',
    accent: '#8B6F47',
    secondaryText: '#6B5D4D',
    cardBackground: '#FFFBF5',
    isDark: false,
  });
  const [activeColorPicker, setActiveColorPicker] = useState<
    'background' | 'text' | 'accent' | null
  >(null);

  const builtInThemes = themes.filter(t => !t.isCustom);
  const customThemes = themes.filter(t => t.isCustom);

  const handleThemeSelect = (theme: Theme) => {
    setTheme(theme);
  };

  const handleCreateTheme = () => {
    if (!newTheme.name?.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your theme.');
      return;
    }

    const theme: Theme = {
      id: `custom_${Date.now()}`,
      name: newTheme.name.trim(),
      background: newTheme.background!,
      text: newTheme.text!,
      accent: newTheme.accent!,
      secondaryText: newTheme.secondaryText!,
      cardBackground: newTheme.cardBackground!,
      isDark:
        newTheme.background!.toLowerCase() === '#000000' ||
        newTheme.background!.toLowerCase() === '#1a1a1a' ||
        newTheme.background!.toLowerCase() === '#1e2430' ||
        newTheme.background!.toLowerCase() === '#1c1816',
      isCustom: true,
    };

    addCustomTheme(theme);
    setShowCreateModal(false);
    setNewTheme({
      name: '',
      background: '#F4EFE8',
      text: '#3A3228',
      accent: '#8B6F47',
      secondaryText: '#6B5D4D',
      cardBackground: '#FFFBF5',
      isDark: false,
    });
  };

  const handleDeleteCustomTheme = (theme: Theme) => {
    Alert.alert(
      'Delete Theme',
      `Are you sure you want to delete "${theme.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeCustomTheme(theme.id),
        },
      ]
    );
  };

  const updateThemeColor = (
    key: 'background' | 'text' | 'accent',
    color: string
  ) => {
    const updates: Partial<Theme> = { [key]: color };

    // Auto-calculate secondary text and card background based on selection
    if (key === 'background') {
      // Determine if dark based on color
      const isDark = ['#000000', '#1a1a1a', '#1e2430', '#1c1816'].includes(
        color.toLowerCase()
      );
      updates.isDark = isDark;
      // Lighten for card background
      updates.cardBackground = isDark ? lightenColor(color, 0.1) : lightenColor(color, 0.03);
    }
    if (key === 'text') {
      updates.secondaryText = adjustOpacity(color, 0.7);
    }

    setNewTheme(prev => ({ ...prev, ...updates }));
    setActiveColorPicker(null);
  };

  const lightenColor = (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.floor((num >> 16) + 255 * amount));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) + 255 * amount));
    const b = Math.min(255, Math.floor((num & 0x0000ff) + 255 * amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  };

  const adjustOpacity = (hex: string, opacity: number): string => {
    // Simple opacity adjustment - blend with background
    return hex + Math.floor(opacity * 255).toString(16).padStart(2, '0');
  };

  // Bottom padding for tab bar
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: tabBarHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText variant="primary" size="title" weight="bold" style={styles.title}>
          Themes
        </ThemedText>
        <ThemedText variant="secondary" size="body" style={styles.subtitle}>
          Choose a reading theme that suits your mood
        </ThemedText>

        {/* Built-in Themes */}
        <View style={styles.section}>
          <ThemedText
            variant="secondary"
            size="caption"
            weight="medium"
            style={styles.sectionTitle}
          >
            BUILT-IN THEMES
          </ThemedText>
          <View style={styles.themesGrid}>
            {builtInThemes.map((theme, index) => (
              <Animated.View
                key={theme.id}
                entering={FadeIn.delay(index * 50)}
                layout={LinearTransition.duration(200)}
              >
                <ThemeCard
                  theme={theme}
                  isSelected={currentTheme.id === theme.id}
                  onSelect={() => handleThemeSelect(theme)}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Custom Themes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText
              variant="secondary"
              size="caption"
              weight="medium"
              style={styles.sectionTitle}
            >
              CUSTOM THEMES
            </ThemedText>
            <PressableScale
              onPress={() => setShowCreateModal(true)}
              style={[
                styles.addButton,
                { backgroundColor: currentTheme.accent + '20' },
              ]}
            >
              <Plus size={16} color={currentTheme.accent} />
              <ThemedText variant="accent" size="caption" weight="semibold">
                Create
              </ThemedText>
            </PressableScale>
          </View>

          {customThemes.length === 0 ? (
            <View
              style={[
                styles.emptyCustom,
                { backgroundColor: currentTheme.cardBackground },
              ]}
            >
              <ThemedText variant="secondary" size="body">
                No custom themes yet
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Create your own theme with custom colors
              </ThemedText>
            </View>
          ) : (
            <View style={styles.themesGrid}>
              {customThemes.map((theme, index) => (
                <Animated.View
                  key={theme.id}
                  entering={FadeIn.delay(index * 50)}
                  layout={LinearTransition.duration(200)}
                >
                  <ThemeCard
                    theme={theme}
                    isSelected={currentTheme.id === theme.id}
                    onSelect={() => handleThemeSelect(theme)}
                    onDelete={() => handleDeleteCustomTheme(theme)}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        {/* Current Theme Preview */}
        <View style={styles.section}>
          <ThemedText
            variant="secondary"
            size="caption"
            weight="medium"
            style={styles.sectionTitle}
          >
            CURRENT THEME PREVIEW
          </ThemedText>
          <View
            style={[
              styles.previewCard,
              { backgroundColor: currentTheme.background },
            ]}
          >
            <View style={styles.previewContent}>
              <ThemedText variant="primary" size="header" weight="bold">
                {currentTheme.name}
              </ThemedText>
              <View style={styles.previewText}>
                <ThemedText variant="primary" size="body">
                  The quick brown fox jumps over the lazy dog.
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={styles.previewSecondary}>
                  Secondary text appears like this.
                </ThemedText>
                <View style={styles.previewAccentRow}>
                  <View
                    style={[
                      styles.previewAccentBar,
                      { backgroundColor: currentTheme.accent },
                    ]}
                  />
                  <ThemedText variant="accent" size="caption" weight="semibold">
                    Accent Color
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Create Theme Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: currentTheme.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <PressableScale onPress={() => setShowCreateModal(false)}>
              <X size={24} color={currentTheme.secondaryText} />
            </PressableScale>
            <ThemedText variant="primary" size="header" weight="semibold">
              Create Theme
            </ThemedText>
            <PressableScale onPress={handleCreateTheme}>
              <Check size={24} color={currentTheme.accent} />
            </PressableScale>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
          >
            {/* Theme Name */}
            <View style={styles.inputGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.inputLabel}
              >
                THEME NAME
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: currentTheme.cardBackground,
                    color: currentTheme.text,
                    borderColor: currentTheme.secondaryText + '30',
                  },
                ]}
                placeholder="My Custom Theme"
                placeholderTextColor={currentTheme.secondaryText}
                value={newTheme.name}
                onChangeText={name => setNewTheme(prev => ({ ...prev, name }))}
              />
            </View>

            {/* Color Pickers */}
            {(['background', 'text', 'accent'] as const).map(colorKey => (
              <View key={colorKey} style={styles.inputGroup}>
                <ThemedText
                  variant="secondary"
                  size="caption"
                  weight="medium"
                  style={styles.inputLabel}
                >
                  {colorKey.toUpperCase()} COLOR
                </ThemedText>
                <PressableScale
                  onPress={() =>
                    setActiveColorPicker(
                      activeColorPicker === colorKey ? null : colorKey
                    )
                  }
                  style={[
                    styles.colorSelector,
                    {
                      backgroundColor: currentTheme.cardBackground,
                      borderColor: currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: newTheme[colorKey] },
                    ]}
                  />
                  <ThemedText variant="primary" size="body">
                    {newTheme[colorKey]}
                  </ThemedText>
                </PressableScale>

                {activeColorPicker === colorKey && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.colorPalette}
                  >
                    {colorPresets.map(color => (
                      <PressableScale
                        key={color}
                        onPress={() => updateThemeColor(colorKey, color)}
                        style={[
                          styles.paletteColor,
                          { backgroundColor: color },
                          ...(newTheme[colorKey] === color ? [styles.selectedColor] : []),
                        ]}
                      />
                    ))}
                  </Animated.View>
                )}
              </View>
            ))}

            {/* Live Preview */}
            <View style={styles.inputGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.inputLabel}
              >
                PREVIEW
              </ThemedText>
              <View
                style={[
                  styles.livePreview,
                  { backgroundColor: newTheme.background },
                ]}
              >
                <View style={[styles.previewLine1, { backgroundColor: newTheme.text }]} />
                <View
                  style={[styles.previewLine2, { backgroundColor: newTheme.text + '80' }]}
                />
                <View
                  style={[styles.previewLine3, { backgroundColor: newTheme.text + '60' }]}
                />
                <View
                  style={[styles.previewAccent, { backgroundColor: newTheme.accent }]}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCustom: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  previewCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  previewContent: {
    padding: 20,
  },
  previewText: {
    marginTop: 12,
  },
  previewSecondary: {
    marginTop: 8,
  },
  previewAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  previewAccentBar: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  colorSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  paletteColor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  livePreview: {
    height: 120,
    borderRadius: 10,
    padding: 16,
  },
  previewLine1: {
    width: '50%',
    height: 10,
    borderRadius: 5,
    marginBottom: 12,
  },
  previewLine2: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  previewLine3: {
    width: '60%',
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
  },
  previewAccent: {
    width: 40,
    height: 6,
    borderRadius: 3,
  },
});
