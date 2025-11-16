import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 11 Pro)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Scale font size based on screen width
 */
export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Scale spacing/dimensions based on screen width
 */
export const scale = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(size * scale);
};

/**
 * Scale vertically based on screen height
 */
export const verticalScale = (size: number): number => {
  const scale = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(size * scale);
};

/**
 * Moderate scale - less aggressive scaling
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return Math.round(size + (scale(size) - size) * factor);
};

/**
 * Get responsive font sizes
 */
export const fontSize = {
  tiny: scaleFont(11),
  small: scaleFont(13),
  regular: scaleFont(15),
  medium: scaleFont(17),
  large: scaleFont(20),
  xlarge: scaleFont(24),
  xxlarge: scaleFont(28),
  huge: scaleFont(32),
  massive: scaleFont(34),
};

/**
 * Get responsive spacing
 */
export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(24),
  xxl: scale(32),
};

/**
 * Check if screen is small (iPhone SE, etc.)
 */
export const isSmallScreen = SCREEN_WIDTH < 375;

/**
 * Check if screen is large (Plus models, etc.)
 */
export const isLargeScreen = SCREEN_WIDTH >= 414;

export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;
