# Quick Start Guide

## Prerequisites

1. Install Node.js 18+ and pnpm
2. Install Expo CLI: `npm install -g expo-cli`
3. Install iOS Simulator (Mac) or Android Emulator
4. Have AWS services configured (see main README)

## Setup Steps

### 1. Install Dependencies

```bash
cd apps/mobile
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your AWS configuration:

```env
EXPO_PUBLIC_AWS_REGION=us-east-1
EXPO_PUBLIC_USER_POOL_ID=your-cognito-user-pool-id
EXPO_PUBLIC_USER_POOL_CLIENT_ID=your-cognito-client-id
EXPO_PUBLIC_IDENTITY_POOL_ID=your-identity-pool-id
EXPO_PUBLIC_API_ENDPOINT=https://your-api-gateway-url
EXPO_PUBLIC_APPSYNC_ENDPOINT=https://your-appsync-url
EXPO_PUBLIC_PINPOINT_APP_ID=your-pinpoint-app-id
```

### 3. Add Assets

Add the following files to the `assets/` directory:
- `icon.png` (1024x1024) - App icon
- `splash.png` (1284x2778) - Splash screen
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `favicon.png` (48x48) - Web favicon
- `notification-icon.png` (96x96) - Notification icon
- `notification-sound.wav` - Notification sound

### 4. Start Development Server

```bash
pnpm start
```

### 5. Run on Device/Simulator

- **iOS**: Press `i` in the terminal or run `pnpm ios`
- **Android**: Press `a` in the terminal or run `pnpm android`
- **Web**: Press `w` in the terminal or run `pnpm web`

## Testing the App

### As a Driver

1. Open the app and select "I'm a Driver"
2. Register with phone number (use format: +1234567890)
3. Enter the OTP code sent to your phone
4. On the home screen, tap one of the SOS buttons (Tire, Engine, or Tow)
5. Allow location permissions when prompted
6. View the incident in the Tracking tab
7. Check incident history in the Incidents tab

### As a Vendor

1. Open the app and select "I'm a Vendor"
2. Register with phone number and business name
3. Enter the OTP code
4. View incoming offers on the home screen
5. Accept an offer to start a job
6. Navigate to the Active Job tab
7. Tap "Start Navigation" to begin tracking
8. Update status as you progress (En Route → Arrived → Work In Progress → Completed)

## Troubleshooting

### Location Not Working
- Ensure location permissions are granted
- Check that location services are enabled on device
- For iOS Simulator, use Debug → Location → Custom Location

### Push Notifications Not Working
- Push notifications don't work on iOS Simulator
- Test on a physical device
- Ensure notification permissions are granted

### AppSync Connection Issues
- Verify AppSync endpoint in .env
- Check network connectivity
- Ensure Cognito authentication is working

### Build Errors
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`
- Check TypeScript errors: `pnpm typecheck`

## Development Tips

### Hot Reload
- Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android) to open dev menu
- Enable Fast Refresh for instant updates

### Debugging
- Use React Native Debugger or Flipper
- View logs in terminal or Expo Dev Tools
- Use `console.log()` for quick debugging

### Testing on Physical Device
1. Install Expo Go app from App Store/Play Store
2. Scan QR code from terminal
3. App will load on your device

## Next Steps

1. Configure AWS services (see infrastructure README)
2. Test all user flows
3. Add custom branding (colors, logos)
4. Configure app signing for production builds
5. Submit to App Store and Google Play

## Useful Commands

```bash
# Start development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Clear cache
expo start -c

# Build for production (requires EAS)
eas build --platform ios
eas build --platform android
```

## Support

For issues or questions:
1. Check the main README.md
2. Review IMPLEMENTATION_SUMMARY.md
3. Check Expo documentation: https://docs.expo.dev
4. Check AWS Amplify documentation: https://docs.amplify.aws
