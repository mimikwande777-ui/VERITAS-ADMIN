'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, Tags, Menu } from 'lucide-react';

interface AdminMobileBottomNavProps {
  onOpenMenu: () => void;
}

export function AdminMobileBottomNav({ onOpenMenu }: AdminMobileBottomNavProps) {
  const pathname = usePathname() || '';

  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Products', href: '/admin/products', icon: ShoppingBag },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'Orders', href: '/admin/orders', icon: Tags },
  ];

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0E0E0E]/95 backdrop-blur-md border-t border-[#1F1F1F] px-2 py-1 flex items-center justify-around"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] min-h-[44px] rounded text-center transition-colors ${
              isActive 
                ? 'text-[#D4AF37]' 
                : 'text-[#777] hover:text-[#BBB]'
            }`}
          >
            <item.icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-[#D4AF37]' : 'text-[#777]'}`} />
            <span className="text-[9px] font-mono font-bold uppercase tracking-tight leading-none">
              {item.name}
            </span>
          </Link>
        );
      })}

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] min-h-[44px] rounded text-center text-[#777] hover:text-white transition-colors cursor-pointer"
      >
        <Menu className="w-4 h-4 mb-0.5 text-[#777]" />
        <span className="text-[9px] font-mono font-bold uppercase tracking-tight leading-none">
          More
        </span>
      </button>
    </nav>
  );
}
