import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  centered?: boolean;
  fullScreen?: boolean;
}

export function Loader({ 
  className, 
  size = 24, 
  strokeWidth = 1.5, 
  centered = true, 
  fullScreen = false 
}: LoaderProps) {
  const loader = (
    <LoaderCircle 
      className={cn("animate-spin text-zinc-500", className)} 
      size={size}
      strokeWidth={strokeWidth} 
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-black z-[100] flex items-center justify-center">
        {loader}
      </div>
    );
  }

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full min-h-[100px] py-8">
        {loader}
      </div>
    );
  }

  return loader;
}
