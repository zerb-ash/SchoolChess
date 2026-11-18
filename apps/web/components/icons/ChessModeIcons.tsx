'use client';

import React from 'react';

// Exact Chess.com styled Bullet Gun Bullet Projectile with Speed Streaks
export const BulletIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    {/* Bullet Projectile Casing & Ogive Tip */}
    <path
      d="M8.5 7.5h5.5c3.2 0 6 2 7.5 4.5-1.5 2.5-4.3 4.5-7.5 4.5H8.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"
      fill="#f97316"
    />
    <path
      d="M12.5 7.5v9"
      stroke="#ea580c"
      strokeWidth="1.2"
      opacity="0.8"
    />
    {/* High-speed motion streaks */}
    <path
      d="M1.5 9h3.5M0.5 12h4.5M2 15h3"
      stroke="#fb923c"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

// Exact Chess.com styled Solid Yellow Lightning Bolt
export const BlitzIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <polygon
      points="13 2 4 13 11 13 9 22 20 10 13 10 15 2"
      fill="#facc15"
    />
  </svg>
);

// Exact Chess.com styled Green Stopwatch / Clock
export const RapidIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    {/* Outer Stopwatch Ring */}
    <circle cx="12" cy="13.5" r="7.8" stroke="#22c55e" strokeWidth="2.2" />
    {/* Top Crown Winder Button */}
    <path d="M12 2.5v3.2M9.5 2.5h5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
    {/* Angled Lap / Pusher Button */}
    <path d="M18 7.5l1.8-1.8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
    {/* Clock Hands showing time */}
    <path d="M12 13.5l2.6-2.6M12 13.5V8.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Classical Hourglass
export const ClassicalIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 2h14M5 22h14M17 2v4a5 5 0 0 1-2.5 4.3L12 12l-2.5-1.7A5 5 0 0 1 7 6V2M7 22v-4a5 5 0 0 1 2.5-4.3L12 12l2.5 1.7A5 5 0 0 1 17 18v4" />
  </svg>
);
