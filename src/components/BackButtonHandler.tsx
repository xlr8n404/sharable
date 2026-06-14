'use client';

import { useEffect } from 'react';
import { useNavBack } from './NavigationHistoryProvider';

/**
 * Component to globally handle back button behavior on mobile devices
 * Prevents app closure and ensures proper in-app navigation
 * Should be placed at the root level of the app
 */
export function BackButtonHandler() {
  const { goBack } = useNavBack();

  useEffect(() => {
    // Detect if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (!isMobile) return;

    // Handle the browser/hardware back button
    const handlePopState = (event: PopStateEvent) => {
      // Prevent the default behavior (which would close the app or go to previous page in browser history)
      event.preventDefault();
      // Use our custom back navigation instead
      goBack();
    };

    // Handle Cordova/Capacitor backbutton event (for native mobile apps)
    const handleBackButton = (event: any) => {
      event.preventDefault?.();
      goBack();
      return true;
    };

    // Add listeners
    window.addEventListener('popstate', handlePopState);

    // For Cordova/Capacitor/native mobile frameworks
    if ((window as any).cordova || (window as any).capacitor || (window as any).device) {
      document.addEventListener('backbutton', handleBackButton);
    }

    // For PWA on Android Chrome
    if ('onpagehide' in window) {
      window.addEventListener('pagehide', () => {
        // Ensure history is maintained
      });
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if ((window as any).cordova || (window as any).capacitor || (window as any).device) {
        document.removeEventListener('backbutton', handleBackButton);
      }
    };
  }, [goBack]);

  // This component doesn't render anything
  return null;
}
