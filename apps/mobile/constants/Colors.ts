// RoadCall Brand Colors
const tintColorLight = '#3b82f6'; // Blue-400
const tintColorDark = '#60a5fa'; // Blue-400

// Gradients (matching web app)
export const GradientColors = {
  primary: {
    blue: '#2563eb',    // Blue-600
    purple: '#a855f7',  // Purple-600
    pink: '#ec4899',    // Pink-600
  },
  light: {
    blue: '#3b82f6',    // Blue-400
    purple: '#c084fc',  // Purple-400
    pink: '#f472b6',    // Pink-400
  },
};

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    border: '#e5e7eb',
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#888',
    tabIconSelected: tintColorDark,
    border: '#333333',
    // RoadCall custom
    surface: '#111111',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
};
