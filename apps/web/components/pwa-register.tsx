'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });

      // Listen for controller change (service worker update)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }

    // Add to home screen prompt (iOS doesn't support, but still good to have)
    if ('standalone' in navigator) {
      // App is running in standalone mode
      console.log('App is running in standalone mode');
    }
  }, []);

  return null; // This component doesn't render anything
}
