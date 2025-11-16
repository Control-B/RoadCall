# Mobile-First PWA Quick Start Guide

## Overview
This guide shows how to run and test the mobile-first RoadCall Progressive Web App (PWA) on your local machine and on mobile devices.

## Prerequisites
- macOS with Node.js 18+
- `pnpm` package manager installed globally
- Modern browser (Chrome, Firefox, Safari, Edge)
- iPhone (iOS 13+) or Android device with web browser

## Starting the Development Server

### 1. Navigate to the project
```bash
cd /Users/banjahmarah/Desktop/RoadCall
```

### 2. Install dependencies (one-time)
```bash
pnpm install
```

### 3. Start the dev server
```bash
cd apps/web
pnpm dev
```

The app will start at `http://localhost:3000`

### 4. Open in browser
- **Desktop Testing**: Go to http://localhost:3000
- **Mobile on Same Network**: Find your machine's IP address:
  ```bash
  # Find your local IP (usually 192.168.x.x or 10.x.x.x)
  ifconfig | grep "inet " | grep -v 127.0.0.1
  ```
  Then visit `http://<YOUR_IP>:3000` from mobile device

## Testing URLs

### Main App
- **Homepage**: http://localhost:3000 (landing page)
- **Login**: http://localhost:3000/auth/login
- **Driver Dashboard**: http://localhost:3000/driver (main hub)

### Driver Screens (5-tab navigation)
1. **Help Now** (Dashboard): http://localhost:3000/driver
   - Shows active incident and recent incidents
   - Prominent "Call for Help" button
   
2. **Find Help**: http://localhost:3000/driver/find-help
   - Browse nearby service providers
   - Provider cards with ratings, distance, ETA
   - Click provider to call or navigate to track
   
3. **Track**: http://localhost:3000/driver/track
   - Real-time GPS tracking visualization
   - Service provider info and ETA
   - Live call button
   
4. **History**: http://localhost:3000/driver/history
   - Timeline of past incidents
   - Cost tracking and statistics
   - Provider ratings
   
5. **Profile**: http://localhost:3000/driver/profile
   - Account information
   - Account settings menu
   - Sign out button

## Browser Testing

### Desktop (Chrome, Firefox, Safari)
1. Open DevTools (F12 or Cmd+Option+I on Mac)
2. Toggle device toolbar (Cmd+Shift+M)
3. Select mobile device preset (iPhone 12, Pixel 5, etc.)
4. Test responsive design and interactions

### Mobile Responsiveness Breakpoints
- **Mobile** (320px - 640px):
  - Single column layout
  - Bottom tab navigation visible
  - Larger touch buttons (h-12 = 48px, h-16 = 64px)
  - Mobile-optimized font sizes
  
- **Tablet** (640px - 1024px):
  - Transition layout
  - Navigation adapts
  
- **Desktop** (1024px+):
  - Multi-column layouts
  - Bottom nav hidden
  - Expanded information cards

### Browser DevTools Testing
1. **Responsive Design**:
   - Chrome/Edge: F12 → Toggle device toolbar (Cmd+Shift+M)
   - Firefox: Ctrl+Shift+M
   - Safari: Develop → Enter Responsive Design Mode

2. **PWA Features**:
   - Chrome: DevTools → Application → Manifest (see PWA metadata)
   - Chrome: DevTools → Application → Service Workers (see SW registration)
   - Chrome: DevTools → Application → Cache Storage (see cached assets)

3. **Offline Testing**:
   - Chrome DevTools → Network → Offline checkbox
   - Refresh page - should load from cache
   - Navigate between screens - should work offline

4. **Performance**:
   - Chrome DevTools → Lighthouse → Generate report
   - Target: 90+ scores for PWA

## iOS Testing (iPhone/iPad)

### In Browser (Safari)
1. **Access from Desktop**:
   - Find your machine IP: `ifconfig | grep "inet "`
   - On iPhone: Open Safari → type `http://<YOUR_IP>:3000`

2. **Add to Home Screen**:
   - Open app in Safari
   - Tap Share button (bottom)
   - Tap "Add to Home Screen"
   - App installs as PWA
   - Launch from home screen - runs fullscreen

3. **Test Features**:
   - Navigate between 5 tabs (bottom navigation)
   - Tap buttons (verify touch responsiveness)
   - Check landscape orientation
   - Test offline: Put phone in airplane mode, app still works

### Debugging
- iPhone: Settings → Safari → Advanced → Web Inspector (enable)
- Desktop Safari: Develop → [iPhone device] → [app page]
- Console logs appear in Safari DevTools

## Android Testing (Phone/Tablet)

### In Browser (Chrome)
1. **Access from Desktop**:
   - Find machine IP
   - On Android: Open Chrome → type `http://<YOUR_IP>:3000`

2. **Install App**:
   - Open app in Chrome
   - Tap menu (3 dots) → "Install app"
   - App appears on home screen as app icon
   - Launch - runs fullscreen

3. **Test Features**:
   - Navigate tabs (bottom navigation visible)
   - Test touch interactions
   - Check landscape mode
   - Test offline (turn off WiFi/data)

### Debugging
- Android: Enable Developer Mode (Settings → About phone → tap build 7 times)
- Android Studio or chrome://inspect → find device and app
- View console logs and network activity

## Feature Testing Checklist

### Navigation
- [ ] Bottom tab navigation visible on mobile
- [ ] Tapping tabs navigates between pages
- [ ] Active tab highlighted in blue
- [ ] Navigation hidden on desktop (md: breakpoint)
- [ ] Back button works (browser back)

### Dashboard Screen
- [ ] "Call for Help Now" button visible and sticky (mobile)
- [ ] Active incident card displays
- [ ] 4 analytics cards (Total, Response, Month, Cost)
- [ ] Recent incidents list loads
- [ ] Quick action buttons work (Find Help, Track)

### Find Help Screen
- [ ] Search bar visible
- [ ] Filter pills (All, Towing, Repair, Assist)
- [ ] Provider cards load with:
  - [ ] Provider name and type
  - [ ] Distance and ETA
  - [ ] Star rating and reviews
  - [ ] Service specialties
  - [ ] Availability badge
  - [ ] Call Now button

### Track Screen
- [ ] Map placeholder visible
- [ ] Status alert displays
- [ ] ETA and status cards show
- [ ] Provider info displays
- [ ] Call Provider button works (opens phone dialer)
- [ ] Update frequency info visible

### History Screen
- [ ] Search bar works
- [ ] Stats bar displays (total, spent, rating)
- [ ] Incident timeline loads
- [ ] Each incident shows:
  - [ ] Type and vendor
  - [ ] Date and duration
  - [ ] Location
  - [ ] Your rating
- [ ] Completed badge shows

### Profile Screen
- [ ] Profile card displays with avatar
- [ ] Account info shows (name, email, phone)
- [ ] Vehicle info displays
- [ ] Menu items visible (4 items)
- [ ] Statistics grid shows 4 metrics
- [ ] Security info visible
- [ ] Sign Out button present

### Responsive Design
- [ ] Mobile (375px):
  - [ ] All text readable
  - [ ] Buttons large enough to tap (44x44px min)
  - [ ] No horizontal scroll
  - [ ] Images scale properly
  
- [ ] Tablet (768px):
  - [ ] Transitive layout
  - [ ] Navigation adjusts
  - [ ] Cards might multi-column
  
- [ ] Desktop (1024px):
  - [ ] Full desktop layout
  - [ ] Dashboard shows 2 columns
  - [ ] Bottom nav hidden
  - [ ] Expanded information views

### PWA Features
- [ ] Manifest loads (DevTools → Application → Manifest)
- [ ] Service Worker registers (DevTools → Service Workers)
- [ ] "Add to Home Screen" works (iOS/Android)
- [ ] App icon appears on home screen
- [ ] App launches fullscreen (no address bar)
- [ ] Offline mode works (cached assets load)

### Visual Design
- [ ] Dark theme applied (black backgrounds)
- [ ] Blue accents for actions
- [ ] Purple accents for secondary info
- [ ] Red for emergency actions
- [ ] Consistent spacing and padding
- [ ] Gradients render correctly
- [ ] Icons from lucide-react load

### Performance
- [ ] Page loads quickly (< 2s on desktop)
- [ ] Smooth scrolling
- [ ] No jank when navigating tabs
- [ ] Icons load instantly (SVG)
- [ ] No console errors

## Troubleshooting

### Dev Server Won't Start
```bash
# Kill any existing process
pkill -f "next dev"

# Clear Next.js cache
rm -rf apps/web/.next

# Reinstall
pnpm install

# Try again
cd apps/web && pnpm dev
```

### Module Not Found Errors
```bash
# lucide-react or other packages not found?
pnpm install

# Clear node_modules and lock
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

### Can't Access from Mobile
1. Verify machine and mobile are on same WiFi network
2. Find correct IP: `ifconfig | grep "inet "` (not 127.0.0.1)
3. Check firewall allows port 3000 (usually not an issue on dev)
4. Try IP from mobile browser: `http://192.168.X.X:3000`

### PWA Not Installing
1. **iOS**: Must be HTTPS or localhost for installation (dev is localhost ✓)
   - Try in Safari instead of Chrome on iOS
2. **Android**: Should work in Chrome
   - Try clearing Chrome cache and cookies

### Service Worker Not Registering
1. Check: DevTools → Application → Service Workers
2. Should show green "activated" status
3. If not registered:
   - Clear browser cache
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Close and reopen browser

### Offline Not Working
1. Check: DevTools → Application → Cache Storage
2. Should show "roadcall-cache" entry
3. If empty:
   - Refresh page to trigger caching
   - Service worker might not have activated yet

## Performance Tips

### Lighthouse Audit (Chrome)
1. DevTools → Lighthouse → Generate report
2. Check scores:
   - Performance (target: 90+)
   - PWA (target: 100)
   - Best Practices (target: 90+)
   - Accessibility (target: 90+)
   - SEO (target: 100)

### Key Performance Metrics
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **TTL** (Time to Interactive): < 3.5s

## Next Steps After Testing

1. **Icon Assets**: Add 192x192, 512x512 PWA icons to `/apps/web/public/icon-*.png`
2. **Real Backend**: Replace mock data with API calls
3. **Maps Integration**: Add Google Maps or Mapbox
4. **Notifications**: Implement push notifications
5. **Analytics**: Add analytics tracking
6. **Optimization**: Run Lighthouse audit and fix issues

## Files Modified

### Core App Files
- `/apps/web/app/driver/page.tsx` - Main dashboard (mobile-optimized)
- `/apps/web/app/driver/layout.tsx` - Responsive layout with headers
- `/apps/web/app/driver/find-help/page.tsx` - Find Help screen
- `/apps/web/app/driver/track/page.tsx` - Track screen
- `/apps/web/app/driver/history/page.tsx` - History screen
- `/apps/web/app/driver/profile/page.tsx` - Profile screen

### Navigation & PWA
- `/apps/web/components/mobile-nav.tsx` - 5-tab mobile navigation
- `/apps/web/public/manifest.json` - PWA manifest (already present)
- `/apps/web/public/sw.js` - Service worker (already present)

## Support & Documentation

- Full implementation details: See `MOBILE_FIRST_PWA_SUMMARY.md`
- Live demo: Run dev server and visit http://localhost:3000/driver
- Source code: `/apps/web/app/driver/` directory

## Quick Commands Reference

```bash
# Start dev server
cd apps/web && pnpm dev

# Build for production
cd apps/web && pnpm build

# Start production server
cd apps/web && pnpm start

# Run TypeScript check
cd apps/web && pnpm type-check

# Format code
pnpm format

# Kill dev server (if stuck)
pkill -f "next dev"

# View app in browser
open http://localhost:3000

# Test on mobile (find your IP first)
ifconfig | grep "inet "  # Then visit http://<YOUR_IP>:3000
```

## Questions?

Refer to:
1. `MOBILE_FIRST_PWA_SUMMARY.md` - Full technical details
2. `/apps/web/README.md` - Web app readme
3. Component source files - Well-commented code
4. Tailwind CSS docs - For responsive design questions
5. Next.js PWA docs - For PWA implementation details
