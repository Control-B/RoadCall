import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  showText?: boolean;
  size?: number;
  className?: string;
}

export function Logo({ showText = true, size = 32, className }: LogoProps) {
  return (
    <Link href="/" aria-label="Company Home" className={`flex items-center gap-2 ${className || ''}`}>
      <Image src="/logo-triangle.svg" alt="Company Logo" width={size} height={size} priority />
      {showText && (
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 via-indigo-500 to-pink-500 text-transparent bg-clip-text">
          RoadCall
        </span>
      )}
    </Link>
  );
}
