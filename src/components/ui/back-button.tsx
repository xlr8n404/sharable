'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  className?: string;
  fallbackHref?: string;
}

export function BackButton({ className, fallbackHref = '/' }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        'flex items-center justify-center w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all',
        className
      )}
      aria-label="Go back"
    >
      <ArrowLeft className="w-5 h-5 text-black dark:text-white" />
    </button>
  );
}
