import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  username?: string;
  identity_tag?: string;
  className?: string;
}

export const VERIFIED_USERNAMES = ['najemislam', 'sharable'];

export function VerifiedBadge({ username, identity_tag, className = "w-4 h-4 text-foreground" }: VerifiedBadgeProps) {
  // Show badge if user has an identity_tag OR if their username is in the verified list
  const isVerified = (identity_tag && identity_tag.length > 0) || 
                    (username && VERIFIED_USERNAMES.includes(username.toLowerCase()));

  if (!isVerified) {
    return null;
  }

  return (
    <BadgeCheck className={className} />
  );
}
