import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Hook to automatically restore scroll position when navigating back to a page
 * Stores scroll position in sessionStorage keyed by pathname
 */
export function useScrollRestoration() {
  const pathname = usePathname();
  const scrollPositions = useRef<Map<string, number>>(new Map());

  // Save scroll position before leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      scrollPositions.current.set(pathname, scrollY);
      try {
        sessionStorage.setItem(
          `scroll_${pathname}`,
          JSON.stringify(scrollY)
        );
      } catch (e) {
        // Silently fail if sessionStorage is unavailable
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pathname]);

  // Restore scroll position when the page loads
  useEffect(() => {
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(`scroll_${pathname}`);
        if (saved) {
          const scrollY = JSON.parse(saved);
          window.scrollTo(0, scrollY);
        }
      } catch (e) {
        // Silently fail if sessionStorage is unavailable
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname]);
}
