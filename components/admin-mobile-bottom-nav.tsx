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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E0E0E]/95 backdrop-blur-md border-t border-[#1F1F1F] px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[48px] px-1 py-1 rounded transition-colors active:scale-95 ${
              isActive 
                ? 'text-[#D4AF37]' 
                : 'text-[#888] hover:text-[#CCC]'
            }`}
          >
            <item.icon className={`w-5 h-5 mb-1 shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-[#888]'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-tight leading-none ${isActive ? 'font-bold text-[#D4AF37]' : 'font-medium text-[#888]'}`}>
              {item.name}
            </span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open full admin menu"
        className="flex flex-col items-center justify-center min-w-[54px] min-h-[48px] px-1 py-1 rounded text-[#888] hover:text-white transition-colors cursor-pointer active:scale-95"
      >
        <Menu className="w-5 h-5 mb-1 text-[#888] shrink-0" />
        <span className="text-[10px] font-mono font-medium uppercase tracking-tight leading-none text-[#888]">
          More
        </span>
      </button>
    </nav>
  );
}
