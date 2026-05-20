import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full py-8 px-6 bg-background text-zinc-500 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <p className="font-bold text-foreground">Sharable</p>
          <p>© {new Date().getFullYear()} Sharable. All rights reserved.</p>
        </div>
        
        <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
          <Link href="/about" className="hover:text-black dark:hover:text-white transition-colors">About Us</Link>
          <Link href="/contact" className="hover:text-black dark:hover:text-white transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms of Service</Link>
        </nav>
      </div>
    </footer>
  );
}
