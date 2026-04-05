import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar, setStatusBarBackgroundColor } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LibraryProvider } from '@/context/LibraryContext';
import { AuthProvider } from '@/context/AuthContext';
import { TermsProvider } from '@/context/TermsContext';
import { SyncProvider } from '@/context/SyncContext';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { PermissionModal } from '@/components/ui/PermissionModal';
import {
  getPermissionStatus,
  markPermissionAsked,
  markPermissionGranted,
  requestStorageDirectory,
} from '@/utils/permissions';
import { logger } from '@/utils/logger';
import 'react-native-reanimated';
import '../global.css';

// Prevent the splash screen from auto-hiding before asset loading is complete.
ExpoSplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { currentTheme, isLoading } = useTheme();
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  // Update status bar color when theme changes
  useEffect(() => {
    if (Platform.OS === 'android') {
      setStatusBarBackgroundColor(currentTheme.background, true);
    }
  }, [currentTheme]);

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const status = await getPermissionStatus();
        logger.info('Permission status checked', status);
        
        // Show modal if permission hasn't been asked yet
        if (!status.hasAsked) {
          // Delay showing modal until after splash
          setTimeout(() => {
            setShowPermissionModal(true);
          }, 2500);
        }
      } catch (error) {
        logger.error('Failed to check permission status', error);
      } finally {
        setPermissionChecked(true);
      }
    };

    checkPermission();
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowCustomSplash(false);
    logger.info('Splash screen completed');
  }, []);

  const handleGrantAccess = async () => {
    try {
      await markPermissionAsked();
      await markPermissionGranted(true);
      setShowPermissionModal(false);
      logger.info('User granted permission, opening SAF directory picker');
      await requestStorageDirectory();
    } catch (error) {
      logger.error('Error handling grant access', error);
    }
  };

  const handleDismissPermission = async () => {
    try {
      await markPermissionAsked();
      await markPermissionGranted(false);
      setShowPermissionModal(false);
      logger.info('User dismissed permission modal');
    } catch (error) {
      logger.error('Error dismissing permission modal', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar
        style={currentTheme.isDark ? 'light' : 'dark'}
        backgroundColor={currentTheme.background}
        translucent={false}
      />
      <Stack
        screenOptions={({ route }) => ({
          headerShown: !route.name.startsWith('tempobook'),
          contentStyle: { backgroundColor: currentTheme.background },
          animation: 'fade',
          navigationBarColor: currentTheme.background,
        })}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="reader/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
      </Stack>

      {/* Custom Splash Screen */}
      {showCustomSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {/* Permission Modal */}
      <PermissionModal
        visible={showPermissionModal}
        onGrantAccess={handleGrantAccess}
        onDismiss={handleDismissPermission}
      />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      ExpoSplashScreen.hideAsync();
      logger.info('App initialized - fonts loaded');
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider>
        <AuthProvider>
          <LibraryProvider>
            <TermsProvider>
              <SyncProvider>
                <RootLayoutNav />
              </SyncProvider>
            </TermsProvider>
          </LibraryProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
