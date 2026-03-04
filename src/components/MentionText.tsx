'use client';

import Link from 'next/link';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface MentionTextProps {
  text: string;
  className?: string;
}

export function MentionText({ text, className }: MentionTextProps) {
  if (!text || typeof text !== 'string') return null;

    const parts = text.split(/(@\w+)|(https?:\/\/[^\s]+)/g);
    
    return (
      <span className={className}>
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.startsWith('@')) {
            const username = part.slice(1);
            return (
              <span key={i} className="inline-flex items-center gap-1">
                <Link 
                  href={`/user/${username}`} 
                  className="text-black dark:text-white font-bold hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {part}
                </Link>
                  <VerifiedBadge username={username} className="w-4 h-4 text-white" />
              </span>
            );
          }
          if (part.startsWith('http')) {
            return (
              <a 
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }
          return part;
        })}
      </span>
    );
}
