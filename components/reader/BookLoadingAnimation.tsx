import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface BookLoadingAnimationProps {
  title?: string;
}

export function BookLoadingAnimation({ title }: BookLoadingAnimationProps) {
  const { currentTheme } = useTheme();

  const page1 = useSharedValue(0);
  const page2 = useSharedValue(0);
  const page3 = useSharedValue(0);
  const pulse = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    shimmer.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );

    page1.value = withRepeat(
      withSequence(
        withDelay(0, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: 0 }),
        withDelay(1200, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );

    page2.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: 0 }),
        withDelay(1000, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );

    page3.value = withRepeat(
      withSequence(
        withDelay(400, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: 0 }),
        withDelay(800, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, []);

  const bookStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pulse.value, [0, 1], [0.97, 1.0]),
      },
    ],
  }));

  const page1Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { rotateY: `${interpolate(page1.value, [0, 1], [0, -180])}deg` },
    ],
    opacity: interpolate(page1.value, [0, 0.5, 1], [1, 0.5, 0]),
    zIndex: 3,
  }));

  const page2Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { rotateY: `${interpolate(page2.value, [0, 1], [0, -180])}deg` },
    ],
    opacity: interpolate(page2.value, [0, 0.5, 1], [1, 0.5, 0]),
    zIndex: 2,
  }));

  const page3Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { rotateY: `${interpolate(page3.value, [0, 1], [0, -180])}deg` },
    ],
    opacity: interpolate(page3.value, [0, 0.5, 1], [1, 0.5, 0]),
    zIndex: 1,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.7, 0.3]),
  }));

  const lineStyle = (delay: number) =>
    useAnimatedStyle(() => ({
      opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.2, 0.5, 0.2]),
      width: `${60 + (delay % 3) * 20}%`,
    }));

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Animated.View style={[styles.bookContainer, bookStyle]}>
        {/* Book base */}
        <View style={[styles.bookBase, { backgroundColor: currentTheme.accent + '25', borderColor: currentTheme.accent + '40' }]}>
          {/* Pages */}
          <Animated.View style={[styles.page, styles.page3, { backgroundColor: currentTheme.cardBackground }, page3Style]}>
            <View style={[styles.pageLine, { backgroundColor: currentTheme.secondaryText + '30', width: '80%' }]} />
            <View style={[styles.pageLine, { backgroundColor: currentTheme.secondaryText + '20', width: '65%' }]} />
          </Animated.View>
          <Animated.View style={[styles.page, styles.page2, { backgroundColor: currentTheme.cardBackground }, page2Style]}>
            <View style={[styles.pageLine, { backgroundColor: currentTheme.secondaryText + '30', width: '75%' }]} />
            <View style={[styles.pageLine, { backgroundColor: currentTheme.secondaryText + '20', width: '60%' }]} />
          </Animated.View>
          <Animated.View style={[styles.page, styles.page1, { backgroundColor: currentTheme.background }, page1Style]}>
            <Animated.View style={shimmerStyle}>
              <View style={[styles.pageLine, { backgroundColor: currentTheme.accent + '40', width: '85%', height: 3 }]} />
              <View style={[styles.pageLine, { backgroundColor: currentTheme.secondaryText + '25', width: '70%' }]} />
              <View style={[styles.pageLine, { backgroundColor: currentTheme.secondaryText + '20', width: '60%' }]} />
            </Animated.View>
          </Animated.View>
          {/* Spine */}
          <View style={[styles.spine, { backgroundColor: currentTheme.accent + '60' }]} />
        </View>
      </Animated.View>

      {/* Loading text */}
      <Animated.View style={[styles.textContainer, shimmerStyle]}>
        <ThemedText variant="secondary" size="body" weight="medium" style={styles.loadingText}>
          {title ? `Loading "${title}"` : 'Loading book...'}
        </ThemedText>
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((i) => (
            <AnimatedDot key={i} delay={i * 200} color={currentTheme.accent} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function AnimatedDot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.2, { duration: 400 }),
        ),
        -1,
        false
      )
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookContainer: {
    marginBottom: 40,
  },
  bookBase: {
    width: 120,
    height: 160,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  page: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 2,
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  page1: {},
  page2: { top: 6, left: 6 },
  page3: { top: 4, left: 4 },
  pageLine: {
    height: 2,
    borderRadius: 1,
    marginBottom: 6,
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  textContainer: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
