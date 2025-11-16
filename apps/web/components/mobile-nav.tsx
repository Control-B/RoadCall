'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Phone, MapPin, TrendingUp, MoreHorizontal, Clock } from 'lucide-react';

const iconMap = {
  help: Phone,
  find: MapPin,
  track: TrendingUp,
  history: Clock,
  profile: MoreHorizontal,
};

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === 'help') return pathname === '/driver';
    return pathname?.includes(path);
  };

  const navItems = [
    { href: '/driver', label: 'Help Now', name: 'help' },
    { href: '/driver/find-help', label: 'Find Help', name: 'find' },
    { href: '/driver/track', label: 'Track', name: 'track' },
    { href: '/driver/history', label: 'History', name: 'history' },
    { href: '/driver/profile', label: 'Profile', name: 'profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-50 md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = iconMap[item.name as keyof typeof iconMap];
          const active = isActive(item.name);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                active
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
