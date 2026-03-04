'use client';

import { useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes of inactivity
const WARNING_BEFORE = 60 * 1000; // Show warning 1 minute before logout

const PUBLIC_ROUTES = ['/', '/login', '/register'];

interface SessionTimeoutProviderProps {
  children: ReactNode;
}

export function SessionTimeoutProvider({ children }: SessionTimeoutProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const isWarningShownRef = useRef(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    toast.error('Session expired due to inactivity');
    router.push('/login');
  }, [router]);

  const showWarning = useCallback(() => {
    if (!isWarningShownRef.current) {
      isWarningShownRef.current = true;
      toast.warning('Your session will expire in 1 minute due to inactivity', {
        duration: 10000,
      });
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated || isPublicRoute) return;

    isWarningShownRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    warningRef.current = setTimeout(showWarning, TIMEOUT_DURATION - WARNING_BEFORE);
    timeoutRef.current = setTimeout(handleLogout, TIMEOUT_DURATION);
  }, [handleLogout, showWarning, isAuthenticated, isPublicRoute]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isPublicRoute) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      return;
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
    };
  }, [resetTimer, isAuthenticated, isPublicRoute]);

  return <>{children}</>;
}
