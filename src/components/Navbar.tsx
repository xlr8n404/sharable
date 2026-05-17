'use client';

import { Share2, Settings2, MessageCircle } from 'lucide-react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

export function Navbar() {
  const isVisible = useScrollDirection();
  
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 w-full px-4 h-16 flex items-center justify-between bg-white dark:bg-black">
        {/* Left: Settings */}
        <div className="flex items-center w-10">
          <Settings2 className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
        </div>

        {/* Center: Share */}
        <div className="flex items-center justify-center flex-1">
          <Share2 className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
        </div>
        
        {/* Right: Messages */}
        <div className="flex items-center justify-end w-10">
          <MessageCircle className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
        </div>
      </nav>
    );
}
