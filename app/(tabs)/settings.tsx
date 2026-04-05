import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Modal, Pressable, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import {
  clearReadingStats,
  getDailyReadingGoalMinutes,
  setDailyReadingGoalMinutes,
} from '@/utils/reading-stats';
import { isSupabaseConfigured } from '@/lib/supabase';

function formatStorageBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { LoggerModal } from '@/components/ui/LoggerModal';
import { PermissionModal } from '@/components/ui/PermissionModal';
import { fontOptions, defaultTypography, defaultReadingSettings } from '@/types/theme';
import { logger } from '@/utils/logger';
import {
  openAppSettings,
  resetPermissionStatus,
} from '@/utils/permissions';
import {
  Type,
  SlidersHorizontal,
  Moon,
  Volume2,
  Eye,
  Minimize2,
  Smartphone,
  Database,
  Trash2,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  AlignLeft,
  AlignJustify,
  Bug,
  Shield,
  User,
  LogIn,
  LogOut,
  Mail,
  Lock,
  Languages,
  Cloud,
  Upload,
  Download,
  Timer,
  HardDrive,
} from 'lucide-react-native';

export default function SettingsScreen() {
  const {
    currentTheme,
    typography,
    setTypography,
    readingSettings,
    setReadingSettings,
  } = useTheme();
  const { clearCache, rescanLibrary, books, estimateLibraryStorageBytes } = useLibrary();
  const {
    user,
    isAuthenticated,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    isLoading: authLoading,
  } = useAuth();
  const { activeAdapterId, setActiveAdapter, isSyncing, lastSyncTime, backupData, restoreData, getAdapter } = useSync();
  const insets = useSafeAreaInsets();
  const [showTypographyModal, setShowTypographyModal] = useState(false);
  const [showLoggerModal, setShowLoggerModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [dailyGoalMinutes, setDailyGoalMinutesState] = useState(30);
  const [libraryBytes, setLibraryBytes] = useState<number | null>(null);

  useEffect(() => {
    getDailyReadingGoalMinutes().then(setDailyGoalMinutesState);
  }, []);

  useEffect(() => {
    if (books.length === 0) {
      setLibraryBytes(0);
      return;
    }
    estimateLibraryStorageBytes().then(setLibraryBytes);
  }, [books, estimateLibraryStorageBytes]);

  // Bottom padding for tab bar
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear reading positions, bookmarks, highlights, and reading stats. Your books will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCache();
              await clearReadingStats();
              Alert.alert('Success', 'Cache and reading data cleared successfully.');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear cache.');
            }
          },
        },
      ]
    );
  };

  const handleRescanLibrary = () => {
    Alert.alert(
      'Rescan Library',
      'This will verify all book files still exist and remove any orphaned entries.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rescan',
          onPress: async () => {
            try {
              const result = await rescanLibrary();
              Alert.alert(
                'Rescan Complete',
                `Found ${result.valid} valid book(s). ${result.removed > 0 ? `Removed ${result.removed} orphaned entry(s).` : 'No orphaned entries found.'}`
              );
            } catch (e) {
              Alert.alert('Error', 'Failed to rescan library.');
            }
          },
        },
      ]
    );
  };

  const handleResetPreferences = () => {
    Alert.alert(
      'Reset Preferences',
      'This will reset all reading and display settings to defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setTypography({ ...defaultTypography });
            setReadingSettings({ ...defaultReadingSettings });
            Alert.alert('Success', 'Preferences reset to defaults.');
          },
        },
      ]
    );
  };

  const currentFont = fontOptions.find(f => f.value === typography.fontFamily)?.label || 'System';

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
          Settings
        </ThemedText>

        {/* Account Section */}
        <SettingsSection title="Account">
          {isAuthenticated ? (
            <>
              <SettingsRow
                icon={<Mail size={18} color={currentTheme.accent} />}
                title={user?.email ?? 'Signed In'}
                subtitle="Signed in with email"
              />
              <SettingsRow
                icon={<LogOut size={18} color="#EF4444" />}
                title="Sign Out"
                onPress={() => {
                  Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
                  ]);
                }}
                danger
              />
            </>
          ) : (
            <SettingsRow
              icon={<LogIn size={18} color={currentTheme.accent} />}
              title="Sign In / Sign Up"
              subtitle="Unlock auto-translation features"
              showChevron
              onPress={() => {
                setAuthMode('login');
                setAuthEmail('');
                setAuthPassword('');
                setAuthError('');
                setShowAuthModal(true);
              }}
            />
          )}
        </SettingsSection>

        {/* Translation Settings (requires login) */}
        {isAuthenticated && (
          <SettingsSection title="Translations">
            <SettingsRow
              icon={<Languages size={18} color={currentTheme.accent} />}
              title="Auto Translation Mode"
              value={readingSettings.autoTranslationMode === 'off' ? 'Off'
                : readingSettings.autoTranslationMode === 'normal' ? 'Normal' : 'Advanced'}
              showChevron
              onPress={() => {
                const modes = ['off', 'normal', 'advanced'] as const;
                const currentIndex = modes.indexOf(readingSettings.autoTranslationMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                setReadingSettings({ autoTranslationMode: modes[nextIndex] });
              }}
            />
          </SettingsSection>
        )}

        {/* Reading goal (Koodo-style habit target) */}
        <SettingsSection title="Daily goal">
          <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
            <ThemedText variant="secondary" size="caption" style={{ marginBottom: 12, lineHeight: 18 }}>
              Minutes to aim for each day. Progress appears on the Home tab using logged reading time.
            </ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[15, 30, 45, 60, 90, 120].map(m => {
                const active = dailyGoalMinutes === m;
                return (
                  <PressableScale
                    key={m}
                    onPress={async () => {
                      await setDailyReadingGoalMinutes(m);
                      setDailyGoalMinutesState(m);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      backgroundColor: active ? currentTheme.accent + '22' : currentTheme.cardBackground,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                    }}
                  >
                    <ThemedText
                      variant={active ? 'accent' : 'primary'}
                      size="caption"
                      weight={active ? 'semibold' : 'regular'}
                    >
                      {m} min
                    </ThemedText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </SettingsSection>

        {/* Reading Settings */}
        <SettingsSection title="Reading">
          <SettingsRow
            icon={<Type size={18} color={currentTheme.accent} />}
            title="Typography"
            subtitle={`${currentFont}, ${typography.fontSize}px`}
            showChevron
            onPress={() => setShowTypographyModal(true)}
          />
          <SettingsRow
            icon={<SlidersHorizontal size={18} color={currentTheme.accent} />}
            title="Page Animation"
            value={readingSettings.pageAnimation.charAt(0).toUpperCase() + readingSettings.pageAnimation.slice(1)}
            showChevron
            onPress={() => {
              const options = ['slide', 'fade', 'curl'] as const;
              const currentIndex = options.indexOf(readingSettings.pageAnimation);
              const nextIndex = (currentIndex + 1) % options.length;
              setReadingSettings({ pageAnimation: options[nextIndex] });
            }}
          />
          <SettingsRow
            icon={<Smartphone size={18} color={currentTheme.accent} />}
            title="Tap Zones"
            subtitle="Enable left/right edge taps in the reader"
            toggle={{
              value: readingSettings.tapZonesEnabled,
              onToggle: value => setReadingSettings({ tapZonesEnabled: value }),
            }}
          />
          <SettingsRow
            icon={<SlidersHorizontal size={18} color={currentTheme.accent} />}
            title="Side tap & swipe"
            subtitle={
              readingSettings.tapZoneNavMode === 'scroll'
                ? 'Scroll within chapter (default)'
                : 'Jump to previous / next chapter'
            }
            showChevron
            onPress={() =>
              setReadingSettings({
                tapZoneNavMode: readingSettings.tapZoneNavMode === 'scroll' ? 'chapter' : 'scroll',
              })
            }
          />
          <SettingsRow
            icon={<Timer size={18} color={currentTheme.accent} />}
            title="Sleep timer"
            subtitle={
              readingSettings.sleepTimerMinutes <= 0
                ? 'Off'
                : `${readingSettings.sleepTimerMinutes} min (while reading)`
            }
            showChevron
            onPress={() => {
              const opts = [0, 15, 30, 45, 60] as const;
              let i = opts.indexOf(readingSettings.sleepTimerMinutes as (typeof opts)[number]);
              if (i < 0) i = 0;
              setReadingSettings({ sleepTimerMinutes: opts[(i + 1) % opts.length] });
            }}
          />
          <SettingsRow
            icon={<Volume2 size={18} color={currentTheme.accent} />}
            title="Volume Button Navigation"
            subtitle="Use volume buttons to turn pages"
            toggle={{
              value: readingSettings.volumeButtonPageTurn,
              onToggle: value => setReadingSettings({ volumeButtonPageTurn: value }),
            }}
          />
          <SettingsRow
            icon={<SlidersHorizontal size={18} color={currentTheme.accent} />}
            title="Bionic reading"
            subtitle="Emphasize word beginnings in the reader"
            toggle={{
              value: readingSettings.bionicReading,
              onToggle: value => setReadingSettings({ bionicReading: value }),
            }}
          />
          <SettingsRow
            icon={<Smartphone size={18} color={currentTheme.accent} />}
            title="Keep screen on"
            subtitle="While a book is open in the reader"
            toggle={{
              value: readingSettings.keepScreenOn,
              onToggle: value => setReadingSettings({ keepScreenOn: value }),
            }}
          />
        </SettingsSection>

        {/* Display Settings */}
        <SettingsSection title="Display">
          <SettingsRow
            icon={<Eye size={18} color={currentTheme.accent} />}
            title="Immersive Mode"
            subtitle="Hide status and navigation bars"
            toggle={{
              value: readingSettings.immersiveMode,
              onToggle: value => setReadingSettings({ immersiveMode: value }),
            }}
          />
          <SettingsRow
            icon={<Moon size={18} color={currentTheme.accent} />}
            title="Blue Light Filter"
            subtitle="Reduce eye strain at night"
            toggle={{
              value: readingSettings.blueLightFilter,
              onToggle: value => setReadingSettings({ blueLightFilter: value }),
            }}
          />
        </SettingsSection>

        {/* Storage */}
        <SettingsSection title="Storage">
          <SettingsRow
            icon={<Database size={18} color={currentTheme.accent} />}
            title="Storage Location"
            value="Internal"
            showChevron
          />
          <SettingsRow
            icon={<HardDrive size={18} color={currentTheme.accent} />}
            title="Library size"
            subtitle={`${books.length} book(s) on disk`}
            value={libraryBytes == null ? '…' : formatStorageBytes(libraryBytes)}
            showChevron={false}
          />
          <SettingsRow
            icon={<FolderOpen size={18} color={currentTheme.accent} />}
            title="Open in File Manager"
            subtitle="Browse /Miyo/ directory"
            showChevron
            onPress={() => {
              Alert.alert('Info', 'This feature requires native file manager access.');
            }}
          />
          <SettingsRow
            icon={<Trash2 size={18} color="#EF4444" />}
            title="Clear Cache"
            subtitle="Remove temporary reading data"
            onPress={handleClearCache}
            danger
          />
        </SettingsSection>

        {/* Sync & Backup */}
        <SettingsSection title="Cloud Sync & Backup">
          <SettingsRow
            icon={<Cloud size={18} color={currentTheme.accent} />}
            title={activeAdapterId ? (getAdapter(activeAdapterId)?.name + ' (Connected)') : 'Connect Cloud Storage'}
            subtitle={lastSyncTime ? `Last synced: ${new Date(lastSyncTime).toLocaleString()}` : (activeAdapterId ? 'Not synced yet' : 'Sign in to Google Drive or WebDAV')}
            showChevron
            onPress={() => {
              if (activeAdapterId) {
                Alert.alert('Disconnect', 'Are you sure you want to disconnect from cloud storage?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Disconnect', style: 'destructive', onPress: () => setActiveAdapter(null) }
                ]);
              } else {
                Alert.alert('Select Provider', 'Choose a cloud storage provider to sync your data.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Google Drive', onPress: async () => {
                     try {
                       const gdrive = getAdapter('gdrive');
                       if (gdrive) {
                         const success = await gdrive.authenticate();
                         if (success) {
                           await setActiveAdapter('gdrive');
                           Alert.alert('Connected', 'Successfully connected to Google Drive.');
                         } else {
                           Alert.alert('Error', 'Authentication failed or was cancelled.');
                         }
                       }
                     } catch (e) {
                       Alert.alert('Error', 'Failed to connect.');
                     }
                  }},
                  { text: 'WebDAV', onPress: () => {
                     Alert.alert('WebDAV', 'WebDAV configuration UI will be added in a future update.');
                  }}
                ]);
              }
            }}
          />
          {activeAdapterId && (
            <>
              <SettingsRow
                icon={<Upload size={18} color={currentTheme.accent} />}
                title={isSyncing ? "Syncing..." : "Backup Data to Cloud"}
                subtitle="Upload reading progress and settings"
                onPress={async () => {
                   if (isSyncing) return;
                   const success = await backupData();
                   if (success) Alert.alert('Success', 'Backup uploaded successfully!');
                   else Alert.alert('Error', 'Failed to upload backup.');
                }}
              />
              <SettingsRow
                icon={<Download size={18} color={currentTheme.accent} />}
                title={isSyncing ? "Syncing..." : "Restore Data from Cloud"}
                subtitle="Download and apply cloud backup"
                onPress={async () => {
                   if (isSyncing) return;
                   Alert.alert('Restore Data', 'This will overwrite your local reading progress with the cloud backup. Continue?', [
                     { text: 'Cancel', style: 'cancel' },
                     { text: 'Restore', style: 'destructive', onPress: async () => {
                        const success = await restoreData();
                        if (success) Alert.alert('Success', 'Backup restored successfully!');
                        else Alert.alert('Error', 'Failed to restore backup.');
                     }}
                   ]);
                }}
              />
            </>
          )}
        </SettingsSection>

        {/* Permissions */}
        <SettingsSection title="Permissions">
          <SettingsRow
            icon={<Shield size={18} color={currentTheme.accent} />}
            title="Storage Permission"
            subtitle="Required to import and read EPUB files"
            showChevron
            onPress={() => setShowPermissionModal(true)}
          />
          <SettingsRow
            icon={<FolderOpen size={18} color={currentTheme.accent} />}
            title="Open App Settings"
            subtitle="Manage app permissions"
            showChevron
            onPress={async () => {
              await openAppSettings();
            }}
          />
        </SettingsSection>

        {/* Advanced */}
        <SettingsSection title="Advanced">
          <SettingsRow
            icon={<Minimize2 size={18} color={currentTheme.accent} />}
            title="Reduced Motion"
            subtitle="Minimize animations"
            toggle={{
              value: readingSettings.reducedMotion,
              onToggle: value => setReadingSettings({ reducedMotion: value }),
            }}
          />
          <SettingsRow
            icon={<RefreshCw size={18} color={currentTheme.accent} />}
            title="Rescan Library"
            subtitle="Find missing or new books"
            showChevron
            onPress={() => {
              logger.info('Library rescan triggered');
              Alert.alert('Scanning...', 'Library scan complete. 0 new books found.');
            }}
          />
          {__DEV__ && (
            <SettingsRow
              icon={<Bug size={18} color={currentTheme.accent} />}
              title="View Console Logs"
              subtitle="Debug and error information"
              showChevron
              onPress={() => setShowLoggerModal(true)}
            />
          )}
          <SettingsRow
            icon={<RotateCcw size={18} color="#EF4444" />}
            title="Reset All Preferences"
            subtitle="Restore default settings"
            onPress={handleResetPreferences}
            danger
          />
        </SettingsSection>

        {/* About */}
        <View style={styles.aboutSection}>
          <ThemedText variant="secondary" size="caption" style={styles.aboutText}>
            Miyo EPUB Reader
          </ThemedText>
          <ThemedText variant="secondary" size="caption" style={styles.aboutText}>
            Version 1.0.0
          </ThemedText>
        </View>
      </ScrollView>

      {/* Typography Modal */}
      <Modal
        visible={showTypographyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTypographyModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: currentTheme.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <PressableScale onPress={() => setShowTypographyModal(false)}>
              <X size={24} color={currentTheme.secondaryText} />
            </PressableScale>
            <ThemedText variant="primary" size="header" weight="semibold">
              Typography
            </ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Font Family */}
            <View style={styles.settingGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.settingLabel}
              >
                FONT FAMILY
              </ThemedText>
              <View style={styles.fontOptions}>
                {fontOptions.map(font => (
                  <PressableScale
                    key={font.value}
                    onPress={() => setTypography({ fontFamily: font.value })}
                    style={[
                      styles.fontOption,
                      {
                        backgroundColor:
                          typography.fontFamily === font.value
                            ? currentTheme.accent + '20'
                            : currentTheme.cardBackground,
                        borderColor:
                          typography.fontFamily === font.value
                            ? currentTheme.accent
                            : 'transparent',
                      },
                    ]}
                  >
                    <ThemedText
                      variant={typography.fontFamily === font.value ? 'accent' : 'primary'}
                      size="body"
                      weight={typography.fontFamily === font.value ? 'semibold' : 'regular'}
                      style={font.value !== 'System' ? { fontFamily: font.value } : undefined}
                    >
                      {font.label}
                    </ThemedText>
                    {typography.fontFamily === font.value && (
                      <Check size={18} color={currentTheme.accent} />
                    )}
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Font Size */}
            <View style={styles.settingGroup}>
              <View style={styles.sliderHeader}>
                <ThemedText
                  variant="secondary"
                  size="caption"
                  weight="medium"
                  style={styles.settingLabel}
                >
                  FONT SIZE
                </ThemedText>
                <ThemedText variant="accent" size="body" weight="semibold">
                  {typography.fontSize}px
                </ThemedText>
              </View>
              <View style={styles.sliderContainer}>
                <ThemedText variant="secondary" size="caption">12</ThemedText>
                <View style={styles.slider}>
                  <View 
                    style={[
                      styles.sliderTrack, 
                      { backgroundColor: currentTheme.secondaryText + '30' }
                    ]}
                  >
                    <View 
                      style={[
                        styles.sliderFill, 
                        { 
                          backgroundColor: currentTheme.accent,
                          width: `${((typography.fontSize - 12) / (28 - 12)) * 100}%`
                        }
                      ]}
                    />
                  </View>
                  <PressableScale
                    style={[
                      styles.sliderThumb,
                      { 
                        backgroundColor: currentTheme.accent,
                        left: `${((typography.fontSize - 12) / (28 - 12)) * 100}%`
                      }
                    ]}
                  />
                </View>
                <ThemedText variant="secondary" size="caption">28</ThemedText>
              </View>
              <View style={styles.sizeButtons}>
                <PressableScale
                  onPress={() => setTypography({ fontSize: Math.max(12, typography.fontSize - 1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="body" weight="bold">A-</ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={() => setTypography({ fontSize: Math.min(28, typography.fontSize + 1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="header" weight="bold">A+</ThemedText>
                </PressableScale>
              </View>
            </View>

            {/* Line Height */}
            <View style={styles.settingGroup}>
              <View style={styles.sliderHeader}>
                <ThemedText
                  variant="secondary"
                  size="caption"
                  weight="medium"
                  style={styles.settingLabel}
                >
                  LINE HEIGHT
                </ThemedText>
                <ThemedText variant="accent" size="body" weight="semibold">
                  {typography.lineHeight.toFixed(1)}
                </ThemedText>
              </View>
              <View style={styles.sizeButtons}>
                <PressableScale
                  onPress={() => setTypography({ lineHeight: Math.max(1.2, typography.lineHeight - 0.1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="body">Compact</ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={() => setTypography({ lineHeight: Math.min(2.0, typography.lineHeight + 0.1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="body">Relaxed</ThemedText>
                </PressableScale>
              </View>
            </View>

            {/* Text Alignment */}
            <View style={styles.settingGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.settingLabel}
              >
                TEXT ALIGNMENT
              </ThemedText>
              <View style={styles.alignmentOptions}>
                <PressableScale
                  onPress={() => setTypography({ textAlign: 'left' })}
                  style={[
                    styles.alignmentOption,
                    {
                      backgroundColor:
                        typography.textAlign === 'left'
                          ? currentTheme.accent + '20'
                          : currentTheme.cardBackground,
                      borderColor:
                        typography.textAlign === 'left'
                          ? currentTheme.accent
                          : 'transparent',
                    },
                  ]}
                >
                  <AlignLeft
                    size={20}
                    color={
                      typography.textAlign === 'left'
                        ? currentTheme.accent
                        : currentTheme.secondaryText
                    }
                  />
                  <ThemedText
                    variant={typography.textAlign === 'left' ? 'accent' : 'secondary'}
                    size="caption"
                    weight="medium"
                  >
                    Left
                  </ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={() => setTypography({ textAlign: 'justify' })}
                  style={[
                    styles.alignmentOption,
                    {
                      backgroundColor:
                        typography.textAlign === 'justify'
                          ? currentTheme.accent + '20'
                          : currentTheme.cardBackground,
                      borderColor:
                        typography.textAlign === 'justify'
                          ? currentTheme.accent
                          : 'transparent',
                    },
                  ]}
                >
                  <AlignJustify
                    size={20}
                    color={
                      typography.textAlign === 'justify'
                        ? currentTheme.accent
                        : currentTheme.secondaryText
                    }
                  />
                  <ThemedText
                    variant={typography.textAlign === 'justify' ? 'accent' : 'secondary'}
                    size="caption"
                    weight="medium"
                  >
                    Justify
                  </ThemedText>
                </PressableScale>
              </View>
            </View>

            {/* Preview */}
            <View style={styles.settingGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.settingLabel}
              >
                PREVIEW
              </ThemedText>
              <View
                style={[
                  styles.preview,
                  { backgroundColor: currentTheme.cardBackground },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: typography.fontSize,
                    lineHeight: typography.fontSize * typography.lineHeight,
                    letterSpacing: typography.letterSpacing,
                    textAlign: typography.textAlign,
                    fontWeight: String(typography.fontWeight) as '400',
                    ...(typography.fontFamily !== 'System' && { fontFamily: typography.fontFamily }),
                  }}
                >
                  The quick brown fox jumps over the lazy dog. This is a preview of how your reading text will appear with the current typography settings.
                </ThemedText>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Logger Modal */}
      <LoggerModal
        visible={showLoggerModal}
        onClose={() => setShowLoggerModal(false)}
      />

      {/* Permission Modal */}
      <PermissionModal
        visible={showPermissionModal}
        onGrantAccess={async () => {
          setShowPermissionModal(false);
          await openAppSettings();
        }}
        onDismiss={() => setShowPermissionModal(false)}
      />

      {/* Auth Modal */}
      <Modal
        visible={showAuthModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.background }]}>
          <View style={styles.modalHeader}>
            <PressableScale onPress={() => setShowAuthModal(false)}>
              <X size={24} color={currentTheme.secondaryText} />
            </PressableScale>
            <ThemedText variant="primary" size="header" weight="semibold">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <View style={[styles.modalContent, { padding: 24 }]}>
            {authError ? (
              <View style={[styles.authErrorBox, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}>
                <ThemedText style={{ color: '#EF4444', fontSize: 13 }}>{authError}</ThemedText>
              </View>
            ) : null}

            {isSupabaseConfigured ? (
              <PressableScale
                onPress={async () => {
                  setAuthError('');
                  const { error, success } = await signInWithGoogle();
                  if (error) setAuthError(error);
                  else if (success) {
                    setShowAuthModal(false);
                    Alert.alert('Signed in', 'You can use translation-related options when signed in.');
                  }
                }}
                style={[
                  styles.googleBtn,
                  { borderColor: currentTheme.secondaryText + '35', backgroundColor: currentTheme.cardBackground },
                ]}
              >
                <ThemedText variant="primary" size="body" weight="semibold">
                  Continue with Google
                </ThemedText>
              </PressableScale>
            ) : (
              <ThemedText variant="secondary" size="caption" style={{ marginBottom: 12, lineHeight: 18 }}>
                Set your Supabase URL and anon key in lib/supabase.ts and enable the Google provider in the
                Supabase dashboard to unlock Google sign-in.
              </ThemedText>
            )}

            <ThemedText variant="secondary" size="caption" weight="medium" style={styles.settingLabel}>
              EMAIL
            </ThemedText>
            <TextInput
              style={[
                styles.authInput,
                {
                  color: currentTheme.text,
                  backgroundColor: currentTheme.cardBackground,
                  borderColor: currentTheme.secondaryText + '25',
                },
              ]}
              placeholder="your@email.com"
              placeholderTextColor={currentTheme.secondaryText + '70'}
              value={authEmail}
              onChangeText={setAuthEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ThemedText variant="secondary" size="caption" weight="medium" style={[styles.settingLabel, { marginTop: 16 }]}>
              PASSWORD
            </ThemedText>
            <TextInput
              style={[
                styles.authInput,
                {
                  color: currentTheme.text,
                  backgroundColor: currentTheme.cardBackground,
                  borderColor: currentTheme.secondaryText + '25',
                },
              ]}
              placeholder="••••••••"
              placeholderTextColor={currentTheme.secondaryText + '70'}
              value={authPassword}
              onChangeText={setAuthPassword}
              secureTextEntry
            />

            <PressableScale
              onPress={async () => {
                setAuthError('');
                if (!authEmail.trim() || !authPassword.trim()) {
                  setAuthError('Please enter both email and password.');
                  return;
                }
                const result = authMode === 'login'
                  ? await signIn(authEmail.trim(), authPassword.trim())
                  : await signUp(authEmail.trim(), authPassword.trim());
                if (result.error) {
                  setAuthError(result.error);
                } else {
                  setShowAuthModal(false);
                  Alert.alert(
                    'Success',
                    authMode === 'login'
                      ? 'Signed in successfully!'
                      : 'Account created! Please check your email to verify.'
                  );
                }
              }}
              style={[styles.authSubmitBtn, { backgroundColor: currentTheme.accent }]}
            >
              <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </ThemedText>
            </PressableScale>

            <PressableScale
              onPress={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
              }}
              style={styles.authToggle}
            >
              <ThemedText variant="secondary" size="body">
                {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              </ThemedText>
              <ThemedText variant="accent" size="body" weight="semibold">
                {authMode === 'login' ? 'Sign Up' : 'Sign In'}
              </ThemedText>
            </PressableScale>
          </View>
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
    marginBottom: 24,
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  aboutText: {
    marginBottom: 4,
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
    padding: 16,
  },
  settingGroup: {
    marginBottom: 28,
  },
  settingLabel: {
    letterSpacing: 1,
    marginBottom: 12,
  },
  fontOptions: {
    gap: 8,
  },
  fontOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  slider: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sizeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sizeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  alignmentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  alignmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
  },
  preview: {
    padding: 16,
    borderRadius: 12,
  },
  authErrorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  googleBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  authInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    marginBottom: 4,
  },
  authSubmitBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
  },
  authToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
});
