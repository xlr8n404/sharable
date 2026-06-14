'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

// Tracks the in-app navigation history so back() stays within the app
// and never falls off to whatever was in the browser history before.
// Also intercepts hardware back button on mobile to prevent app closure.

const NAV_STACK_KEY = 'app_nav_stack';

function getStack(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) || '[]');
  } catch {
    return [];
  }
}

function setStack(stack: string[]) {
  try {
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  } catch {}
}

interface NavHistoryContextValue {
  goBack: (fallback?: string) => void;
  canGoBack: () => boolean;
}

const NavHistoryContext = createContext<NavHistoryContextValue>({
  goBack: () => {},
  canGoBack: () => false,
});

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathname = useRef<string | null>(null);
  const contextRef = useRef<NavHistoryContextValue | null>(null);

  // Handle hardware back button on mobile and browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      // Prevent default browser behavior and use our custom back logic
      if (contextRef.current) {
        contextRef.current.goBack();
      }
    };

    // Listen for popstate (browser/hardware back button)
    window.addEventListener('popstate', handlePopState);
    
    // For Android WebView, also listen for backbutton event if available
    const handleBackButton = () => {
      if (contextRef.current) {
        contextRef.current.goBack();
      }
      return true; // Prevent default
    };
    
    // Check if we're in a WebView or mobile environment
    if ((window as any).cordova || (window as any).phonegap || (window as any).device) {
      document.addEventListener('backbutton', handleBackButton);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if ((window as any).cordova || (window as any).phonegap || (window as any).device) {
        document.removeEventListener('backbutton', handleBackButton);
      }
    };
  }, []);

  useEffect(() => {
    const stack = getStack();
    const current = pathname;

    if (prevPathname.current === null) {
      // First render — seed the stack if empty
      if (stack.length === 0) {
        setStack([current]);
      }
      prevPathname.current = current;
      return;
    }

    if (prevPathname.current === current) return;

    const prev = prevPathname.current;
    prevPathname.current = current;

    // If we're going back (current is the previous item in stack), pop
    const latestStack = getStack();
    const prevIndex = latestStack.lastIndexOf(current);
    if (prevIndex !== -1 && prevIndex === latestStack.length - 2) {
      // User navigated back — pop the top
      setStack(latestStack.slice(0, latestStack.length - 1));
    } else {
      // Forward navigation — push
      // Avoid duplicating the same route consecutively
      if (latestStack[latestStack.length - 1] !== current) {
        // Cap stack at 50 entries to avoid memory bloat
        const next = [...latestStack, current].slice(-50);
        setStack(next);
      }
    }
  }, [pathname]);

  const canGoBack = () => {
    const stack = getStack();
    return stack.length > 1;
  };

  const goBack = (fallback = '/home') => {
    const stack = getStack();
    if (stack.length > 1) {
      // Pop from our stack and navigate to the previous route
      const newStack = stack.slice(0, stack.length - 1);
      setStack(newStack);
      const previousRoute = newStack[newStack.length - 1];
      router.push(previousRoute);
    } else {
      // If no history, go to fallback
      router.push(fallback);
    }
  };

  const contextValue: NavHistoryContextValue = { goBack, canGoBack };
  contextRef.current = contextValue;

  return (
    <NavHistoryContext.Provider value={contextValue}>
      {children}
    </NavHistoryContext.Provider>
  );
}

export function useNavBack() {
  return useContext(NavHistoryContext);
}
