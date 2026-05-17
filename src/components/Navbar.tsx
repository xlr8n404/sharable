'use client';

import { Share2, Settings2, MessageCircle } from 'lucide-react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

export function Navbar() {
  const isVisible = useScrollDirection();
  
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 w-full px-4 h-16 flex items-center justify-between bg-white dark:bg-black">

            <div className="flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
            </div>

      <div className="flex items-center gap-8 text-zinc-500">
        <Share2 className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
      </div>
      
      <div className="flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
      </div>
    </nav>
  );
}
