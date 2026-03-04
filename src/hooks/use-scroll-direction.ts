'use client';

import { useState, useEffect, useRef } from 'react';

export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Initial scroll position
    lastScrollY.current = window.scrollY;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const diff = scrollY - lastScrollY.current;

      // Only update if we've scrolled a bit (threshold)
      // and we're not near the top
      if (Math.abs(diff) > 10) {
        if (diff > 0 && isVisible && scrollY > 80) {
          // Scrolling down - hide
          setIsVisible(false);
        } else if (diff < 0 && !isVisible) {
          // Scrolling up - show
          setIsVisible(true);
        }
        lastScrollY.current = scrollY > 0 ? scrollY : 0;
      }

      // Always show at the top
      if (scrollY < 10) {
        setIsVisible(true);
      }
      
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isVisible]);

  return isVisible;
}
