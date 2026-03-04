'use client';

import { Share2, PlusSquare, Search, Home, Bell, User, UserRoundPlus } from 'lucide-react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import Link from 'next/link';

export function Navbar() {
  const isVisible = useScrollDirection();
  
    return (
      <nav className={`fixed top-0 left-0 right-0 z-50 w-full px-4 h-16 flex items-center justify-between bg-white/80 dark:bg-black/80 backdrop-blur-xl transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>

            <div className="flex items-center gap-2">
              <Share2 className="w-8 h-8 text-black dark:text-white" />
              <span className="font-bold text-[32px] tracking-tighter">
                Sharable
              </span>
            </div>

      <div className="flex items-center gap-8 text-zinc-500">
        <Link href="/home" className="hover:text-white transition-colors">
            <Home className="w-6 h-6 text-white" strokeWidth={1.5} />
          </Link>
          <Link href="/connect" className="hover:text-white transition-colors">
            <UserRoundPlus className="w-6 h-6" strokeWidth={1.5} />
          </Link>
          <button className="hover:text-white transition-colors">
            <Search className="w-6 h-6" strokeWidth={1.5} />
          </button>
        <button className="hover:text-white transition-colors">
          <PlusSquare className="w-6 h-6" strokeWidth={1.5} />
        </button>
        <button className="hover:text-white transition-colors">
          <Bell className="w-6 h-6" strokeWidth={1.5} />
        </button>

      </div>
    </nav>
  );
}
