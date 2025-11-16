# Design Document

## Overview

This design implements safe area handling for the RoadCall mobile application using `react-native-safe-area-context`. The solution ensures content doesn't get hidden behind notches, status bars, or home indicators on iOS and Android devices.

Simple three-step approach:
1. Add SafeAreaProvider at the root
2. Wrap screens with SafeAreaView
3. Add bottom safe area padding to the TabBar

## Architecture

### Safe Area Strategy

**All Screens**:
- Wrap with `SafeAreaView` using `edges={['top']}` to avoid status bar/notch
- Remove hardcoded top margins/padding that were compensating for status bar

**TabBar**:
- Use `useSafeAreaInsets` hook to get bottom inset
- Apply dynamic bottom padding to sit above home indicator

## Components and Interfaces

### 1. Root Layout (`app/_layout.tsx`)
- Wrap Stack with `SafeAreaProvider`

### 2. TabBar (`src/navigation/MainNavigator.tsx`)
- Use `useSafeAreaInsets()` hook
- Change `paddingBottom: 20` to `paddingBottom: Math.max(insets.bottom, 8)`

### 3. All Screen Files
Wrap the outermost container with `SafeAreaView` from `react-native-safe-area-context`:
- Import: `import { SafeAreaView } from 'react-native-safe-area-context';`
- Use `edges={['top']}` for most screens
- Remove any hardcoded top padding/margin that was compensating for status bar

## Data Models

No new data models needed. Using existing types from `react-native-safe-area-context`.

## Error Handling

No special error handling required. The library handles edge cases automatically.

## Testing Strategy

Test on a device with a notch (iPhone X or newer) or Android with gesture navigation:
1. Verify content doesn't hide behind status bar
2. Verify TabBar sits above home indicator
3. Check all screens display properly
