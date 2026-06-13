'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import { motion } from "framer-motion";
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

export default function RegisterPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [checking, setChecking] = useState(true);
  const [mounted, setMounted] = useState(false);

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
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.push('/')}
            className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </motion.button>
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mb-4"
        >
          <Logo size="md" showText={false} />
        </motion.div>

        <RegisterForm
          onSwitchToLogin={() => router.push('/login')}
        />
      </main>
    </div>
  );
}
