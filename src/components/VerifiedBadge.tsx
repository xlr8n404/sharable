import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  username?: string;
  className?: string;
}

export const VERIFIED_USERNAMES = ['najemislam'];

export function VerifiedBadge({ username, className = "w-4 h-4 text-black dark:text-white" }: VerifiedBadgeProps) {
  if (!username || !VERIFIED_USERNAMES.includes(username.toLowerCase())) {
    return null;
  }

  return (
    <BadgeCheck className={className} />
  );
}
