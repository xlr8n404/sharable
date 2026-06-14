import { useEffect } from 'react';
import { useNavBack } from '@/components/NavigationHistoryProvider';

/**
 * Hook to handle Android back button behavior
 * Prevents the app from closing and ensures proper navigation
 */
export function useAndroidBackButton() {
  const { goBack } = useNavBack();

  useEffect(() => {
    // Check if we're in a mobile environment
    const isAndroid = /Android/.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isMobileWeb = isAndroid || isIOS;

    if (!isMobileWeb) return;

    // Handle popstate event (browser/hardware back button)
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      goBack();
    };

    // Handle Cordova/Capacitor back button event
    const handleBackButton = () => {
      goBack();
      return true; // Prevent default
    };

    window.addEventListener('popstate', handlePopState);

    // For Cordova/Capacitor apps
    if ((window as any).cordova || (window as any).capacitor) {
      document.addEventListener('backbutton', handleBackButton);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if ((window as any).cordova || (window as any).capacitor) {
        document.removeEventListener('backbutton', handleBackButton);
      }
    };
  }, [goBack]);
}
