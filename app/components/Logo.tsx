'use client';

import { useId } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  rounded?: boolean;
}

/**
 * Marque "Wealth OS" : trois barres ascendantes qui se prolongent en flèche
 * (croissance), dégradé vert émeraude → bleu, sur fond bleu marine, avec un
 * léger effet de lueur — reprend le logo choisi par l'utilisateur (généré
 * en externe) pour rester identique entre l'app, app/icon.svg,
 * app/apple-icon.png et app/favicon.ico.
 */
export default function Logo({ size = 28, className = '', rounded = true }: LogoProps) {
  const uid = useId();
  const gradId = `logo-grad-${uid}`;
  const glowId = `logo-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Wealth OS"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="80" x2="0" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" rx={rounded ? 22 : 0} fill="#0c1526" />
      <g transform="rotate(-24 55 46)" filter={`url(#${glowId})`}>
        <rect x="28" y="56" width="10" height="22" rx="1.5" fill={`url(#${gradId})`} />
        <rect x="46" y="44" width="10" height="34" rx="1.5" fill={`url(#${gradId})`} />
        <rect x="64" y="28" width="10" height="50" rx="1.5" fill={`url(#${gradId})`} />
        <path d="M69 9 L57 30 L81 30 Z" fill={`url(#${gradId})`} />
      </g>
    </svg>
  );
}
