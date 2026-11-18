import React from 'react';
import { BadgeCheck } from 'lucide-react';

interface OwnerBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function isOwner(username?: string | null): boolean {
  if (!username) return false;
  return username.trim().toLowerCase() === 'admin';
}

export const OwnerBadge: React.FC<OwnerBadgeProps> = ({
  className = '',
  size = 'md',
}) => {
  const iconSize =
    size === 'xs'
      ? 'w-3 h-3'
      : size === 'sm'
      ? 'w-3.5 h-3.5'
      : size === 'lg'
      ? 'w-5 h-5'
      : 'w-4 h-4';

  return (
    <span
      title="Verified Owner"
      className={`inline-flex items-center text-brass-400 align-middle shrink-0 cursor-default select-none ${className}`}
    >
      <BadgeCheck className={`${iconSize} fill-brass-500/25 text-brass-400 drop-shadow-sm`} />
    </span>
  );
};
