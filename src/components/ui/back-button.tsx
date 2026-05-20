'use client';

import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavBack } from '@/components/NavigationHistoryProvider';

interface BackButtonProps {
  className?: string;
  fallbackHref?: string;
}

export function BackButton({ className, fallbackHref = '/home' }: BackButtonProps) {
  const { goBack } = useNavBack();

  return (
    <button
      onClick={() => goBack(fallbackHref)}
      className={cn(
        'flex items-center justify-center w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all',
        className
      )}
      aria-label="Go back"
    >
      <ArrowLeft className="w-5 h-5 text-foreground" />
    </button>
  );
}
