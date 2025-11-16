# Implementation Plan

- [ ] 1. Add SafeAreaProvider to root layout
  - Wrap the Stack navigator in `app/_layout.tsx` with SafeAreaProvider from react-native-safe-area-context
  - This provides safe area context to all child components
  - _Requirements: 1.1_

- [ ] 2. Update TabBar with dynamic bottom padding
  - Import useSafeAreaInsets hook in `src/navigation/MainNavigator.tsx`
  - Replace hardcoded `paddingBottom: 20` with `paddingBottom: Math.max(insets.bottom, 8)`
  - Ensure TabBar sits above home indicator on modern devices
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Update main screens with SafeAreaView
- [ ] 3.1 Update HomeScreen
  - Wrap ScrollView with SafeAreaView using edges={['top']} in `src/screens/main/HomeScreen.tsx`
  - Remove hardcoded marginTop: 16 from header style
  - _Requirements: 1.2, 3.1, 3.3_

- [ ] 3.2 Update FindScreen
  - Wrap main container with SafeAreaView using edges={['top']} in `src/screens/main/FindScreen.tsx`
  - _Requirements: 1.2, 3.1_

- [ ] 3.3 Update HistoryScreen
  - Wrap ScrollView with SafeAreaView using edges={['top']} in `src/screens/main/HistoryScreen.tsx`
  - _Requirements: 1.2, 3.1, 3.3_

- [ ] 3.4 Update MoreScreen
  - Wrap ScrollView with SafeAreaView using edges={['top']} in `src/screens/main/MoreScreen.tsx`
  - Remove hardcoded paddingTop: 48 from header style
  - _Requirements: 1.2, 3.1, 3.3_

- [ ] 4. Update authentication screens with SafeAreaView
- [ ] 4.1 Update LoginScreen
  - Wrap KeyboardAvoidingView with SafeAreaView using edges={['top', 'bottom']} in `src/screens/auth/LoginScreen.tsx`
  - _Requirements: 1.2, 4.1, 4.2, 4.4_

- [ ] 4.2 Update RegisterScreen
  - Wrap KeyboardAvoidingView with SafeAreaView using edges={['top', 'bottom']} in `src/screens/auth/RegisterScreen.tsx`
  - _Requirements: 1.2, 4.1, 4.2, 4.4_

- [ ] 5. Update request flow screens with SafeAreaView
- [ ] 5.1 Update NewRequestScreen
  - Wrap ScrollView with SafeAreaView using edges={['top', 'bottom']} in `src/screens/request/NewRequestScreen.tsx`
  - Remove hardcoded marginTop: 16 from header style
  - _Requirements: 1.2, 3.1, 3.3, 5.1, 5.2_

- [ ] 5.2 Update SearchingScreen
  - Wrap main container with SafeAreaView using edges={['top', 'bottom']} in `src/screens/request/SearchingScreen.tsx`
  - _Requirements: 1.2, 5.1, 5.2, 5.3_

- [ ] 5.3 Update ActiveJobScreen
  - Import useSafeAreaInsets hook in `src/screens/request/ActiveJobScreen.tsx`
  - Add bottom padding to bottomSheet style using insets.bottom
  - Ensure map extends to full screen while bottom sheet sits above home indicator
  - _Requirements: 1.2, 5.1, 5.2, 5.3_

- [ ] 5.4 Update RequestDetailScreen
  - Wrap ScrollView with SafeAreaView using edges={['top', 'bottom']} in `src/screens/request/RequestDetailScreen.tsx`
  - _Requirements: 1.2, 5.1, 5.2, 5.3_

- [ ] 6. Update profile and settings screens with SafeAreaView
- [ ] 6.1 Update ProfileScreen
  - Wrap ScrollView with SafeAreaView using edges={['top']} in `src/screens/main/ProfileScreen.tsx`
  - _Requirements: 1.2, 3.1, 3.3_

- [ ] 6.2 Update SettingsScreen
  - Wrap ScrollView with SafeAreaView using edges={['top']} in `src/screens/main/SettingsScreen.tsx`
  - _Requirements: 1.2, 3.1, 3.3_
