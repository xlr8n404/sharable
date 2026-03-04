'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes of inactivity
const WARNING_BEFORE = 60 * 1000; // Show warning 1 minute before logout

export function useSessionTimeout() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const isWarningShownRef = useRef(false);

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
    isWarningShownRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    warningRef.current = setTimeout(showWarning, TIMEOUT_DURATION - WARNING_BEFORE);
    timeoutRef.current = setTimeout(handleLogout, TIMEOUT_DURATION);
  }, [handleLogout, showWarning]);

  useEffect(() => {
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
  }, [resetTimer]);
}
