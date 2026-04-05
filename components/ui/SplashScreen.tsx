import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { ThemedText } from '@/components/ui/ThemedText';

interface SplashScreenProps {
  onComplete?: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }).start(() => {
      // Exit animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start(() => {
        onComplete?.();
      });
    });
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.iconWrapper}>
            <BookOpen size={56} color="#FFFBF5" />
          </View>
        </View>

        {/* App Name */}
        <ThemedText
          style={styles.appName}
          size="title"
          weight="bold"
        >
          Miyo
        </ThemedText>

        <ThemedText style={styles.tagline} size="body">
          Your Personal Reading Sanctuary
        </ThemedText>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth },
              ]}
            />
          </View>
          <ThemedText style={styles.loadingText} size="caption">
            Loading your library...
          </ThemedText>
        </View>
      </Animated.View>

      {/* Version */}
      <ThemedText style={styles.version} size="caption">
        Version 1.0.0
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: '#8B6F47',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B6F47',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  appName: {
    color: '#FFFBF5',
    fontSize: 42,
    letterSpacing: 2,
    marginBottom: 8,
  },
  tagline: {
    color: '#A0A0B0',
    marginBottom: 48,
  },
  progressContainer: {
    width: 200,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B6F47',
    borderRadius: 2,
  },
  loadingText: {
    color: '#707080',
    marginTop: 16,
  },
  version: {
    position: 'absolute',
    bottom: 48,
    color: '#505060',
  },
});
