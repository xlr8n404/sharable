'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Loader } from "@/components/ui/loader";
import { motion, AnimatePresence } from "framer-motion";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Share2 } from "lucide-react";

const Logo = ({ size = 'md', showText = true, orientation = 'vertical', className = '' }: { size?: 'sm' | 'md' | 'lg', showText?: boolean, orientation?: 'vertical' | 'horizontal', className?: string }) => {
  const { theme } = useTheme();

  const containerSizes = {
    sm: "w-10 h-10 rounded-lg",
    md: "w-16 h-16 rounded-2xl",
    lg: "w-20 h-20 rounded-3xl"
  };

  const iconSizes = {
    sm: 20,
    md: 32,
    lg: 40
  };

  const textSizes = {
    sm: "text-xl",
    md: "text-xl",
    lg: "text-3xl"
  };

  const isVertical = orientation === 'vertical';
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-white' : 'bg-black';
  const iconColor = isDark ? 'text-black' : 'text-white';

  return (
    <div className={`flex ${isVertical ? 'flex-col items-center' : 'flex-row items-center gap-3'} ${className}`}>
      <div className={`${containerSizes[size]} ${bgColor} flex items-center justify-center ${isVertical && size !== 'sm' ? (size === 'lg' ? 'mb-6' : 'mb-4') : ''}`}>
        <Share2 size={iconSizes[size]} className={iconColor} strokeWidth={1.5} />
      </div>
      {showText && (
        <span className={`font-syne font-bold ${textSizes[size]} tracking-tight ${size === 'lg' ? 'tracking-tighter' : ''}`}>
          Sharable
        </span>
      )}
    </div>
  );
};

type View = 'landing' | 'login' | 'register';

export default function Home() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<View>('landing');
  const [checking, setChecking] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setMounted(true);
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user) {
          router.replace('/home');
        } else {
          setChecking(false);
        }
      } catch (error) {
        setChecking(false);
      }
    };
    checkSession();
  }, [router]);

  const handleViewChange = (newView: View) => {
    setView(newView);
    if (newView !== 'landing') {
      window.history.pushState({ view: newView }, '');
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.view) {
        setView(event.state.view);
      } else {
        setView('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-300">

      {/* ── HEADER ── */}
      <div className="fixed top-0 left-0 w-full p-6 z-50 flex items-center justify-between">
        <div className="flex items-center min-w-[40px]">
          <AnimatePresence mode="wait">
            {view !== 'landing' && (
              <motion.button
                key="back-button"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => handleViewChange('landing')}
                className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-6 h-6" />
              ) : (
                <Moon className="w-6 h-6" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto w-full py-20">

          <AnimatePresence mode="wait">
            {view !== 'landing' && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-4"
                >
                  <Logo size="md" showText={false} />
                </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {view === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center"
              >
                  {/* Logo */}
                  <div className="mb-12">
                    <Logo size="lg" />
                  </div>

              {/* Auth Buttons */}
              <div className="flex flex-col gap-4 w-full">
                <button
                  onClick={() => handleViewChange('login')}
                  className="flex items-center justify-center w-full h-[56px] bg-foreground text-background font-bold text-lg rounded-full transition-all hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  Log in
                </button>
                <button
                  onClick={() => handleViewChange('register')}
                  className="flex items-center justify-center w-full h-[56px] bg-neutral-100 dark:bg-neutral-900 text-foreground font-bold text-lg rounded-full border border-neutral-200 dark:border-neutral-800 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  Create Account
                </button>
              </div>
            </motion.div>
          )}

          {view === 'login' && (
            <LoginForm
              key="login-form"
              onSwitchToRegister={() => setView('register')}
            />
          )}

          {view === 'register' && (
            <RegisterForm
              key="register-form"
              onSwitchToLogin={() => setView('login')}
            />
          )}
        </AnimatePresence>
      </main>

      {/* ── FOOTER ── */}
      <AnimatePresence>
        {view === 'landing' && (
          <motion.footer
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full py-12 px-6 border-t border-neutral-100 dark:border-neutral-900 bg-background"
          >
              <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">

                <span className="font-syne font-bold text-xl tracking-tight">Sharable</span>

                <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                <Link href="/about" className="text-neutral-500 hover:text-foreground transition-colors text-sm">About</Link>
                <Link href="/contact" className="text-neutral-500 hover:text-foreground transition-colors text-sm">Contact</Link>
                <Link href="/privacy-policy" className="text-neutral-500 hover:text-foreground transition-colors text-sm">Privacy policy</Link>
                <Link href="/terms-of-service" className="text-neutral-500 hover:text-foreground transition-colors text-sm">Terms of Service</Link>
                <Link href="/community-guidelines" className="text-neutral-500 hover:text-foreground transition-colors text-sm">Community Guidelines</Link>
              </nav>

              <p className="text-neutral-600 dark:text-neutral-500 text-[12px] font-medium">
                ©{year} Sharable. All rights reserved.
              </p>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
