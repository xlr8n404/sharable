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

const ShareIcon = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="75" cy="20" r="12" stroke={color} strokeWidth="7" fill="none"/>
    <circle cx="25" cy="50" r="12" stroke={color} strokeWidth="7" fill="none"/>
    <circle cx="75" cy="80" r="12" stroke={color} strokeWidth="7" fill="none"/>
    <line x1="36" y1="45" x2="64" y2="25" stroke={color} strokeWidth="7" strokeLinecap="round"/>
    <line x1="36" y1="55" x2="64" y2="75" stroke={color} strokeWidth="7" strokeLinecap="round"/>
  </svg>
);

const Logo = ({ size = 'md', showText = true, orientation = 'vertical', className = '' }: { size?: 'sm' | 'md' | 'lg', showText?: boolean, orientation?: 'vertical' | 'horizontal', className?: string }) => {
  const containerSizes = {
    sm: "w-10 h-10 rounded-xl",
    md: "w-16 h-16 rounded-2xl",
    lg: "w-20 h-20 rounded-3xl shadow-2xl shadow-foreground/10"
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

  return (
    <div className={`flex ${isVertical ? 'flex-col items-center' : 'flex-row items-center gap-3'} ${className}`}>
      <div className={`${containerSizes[size]} flex items-center justify-center bg-foreground text-background ${isVertical && size !== 'sm' ? (size === 'lg' ? 'mb-6' : 'mb-4') : ''}`}>
        <ShareIcon size={iconSizes[size]} />
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
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
                onClick={() => setView('landing')}
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
                  className="mb-8"
                >
                  <Logo size="md" />
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
                  onClick={() => setView('login')}
                  className="flex items-center justify-center w-full h-[56px] bg-foreground text-background font-bold text-lg rounded-full transition-all hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  Log in
                </button>
                <button
                  onClick={() => setView('register')}
                  className="flex items-center justify-center w-full h-[56px] bg-neutral-100 dark:bg-neutral-900 text-foreground font-bold text-lg rounded-full border border-neutral-200 dark:border-neutral-800 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  Create Account
                </button>
                
                <div className="flex items-center gap-4 my-2">
                  <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                  <span className="text-neutral-500 text-sm font-medium">or</span>
                  <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                </div>

                <a
                  href="/api/auth/google"
                  className="flex items-center justify-center gap-3 w-full h-[56px] bg-background text-foreground font-bold text-lg rounded-full border border-neutral-200 dark:border-neutral-800 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </a>
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
                
                <Logo size="sm" orientation="horizontal" />

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
