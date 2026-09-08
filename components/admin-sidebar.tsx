'use client';

import Link from 'next/link';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Settings, 
  Tags, 
  Image as ImageIcon,
  BarChart3,
  Package,
  Layers,
  Activity,
  TicketPercent,
  ShieldCheck,
  ShieldAlert,
  Globe,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { useAdminAuth } from '@/lib/auth-context';
import { PWAInstallButton } from '@/components/pwa-install-button';

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/admin/products', icon: ShoppingBag },
  { name: 'Inventory', href: '/admin/inventory', icon: Package },
  { name: 'Orders & OTC', href: '/admin/orders', icon: Tags },
  { name: 'Sales & Reports', href: '/admin/sales', icon: BarChart3 },
  { name: 'Collections', href: '/admin/collections', icon: Layers },
  { name: 'Categories', href: '/admin/categories', icon: Tags },
  { name: 'Customers', href: '/admin/customers', icon: Users },
  { name: 'Discounts', href: '/admin/discounts', icon: TicketPercent },
  { name: 'Media Library', href: '/admin/media', icon: ImageIcon },
  { name: 'Activity Log', href: '/admin/activity', icon: Activity },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar({ currentPath, onNavigate }: { currentPath: string; onNavigate?: () => void }) {
  const { user, role, signOut, hasAccess } = useAdminAuth();

  return (
    <div className="flex flex-col w-full md:w-64 bg-[#0F0F0F] border-r border-[#1F1F1F] text-[#E0E0E0] h-full min-h-full">
      {/* BRAND & HEADER */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-[#1F1F1F]">
        <Link href="/admin/dashboard" onClick={onNavigate} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white flex items-center justify-center rounded-xs shadow">
            <div className="w-4 h-4 bg-black rotate-45"></div>
          </div>
          <div>
            <span className="text-sm font-bold tracking-[0.2em] text-white block leading-none">VERITAS</span>
            <span className="text-[9px] tracking-[0.2em] text-[#D4AF37] font-mono uppercase block mt-1">ADMIN CONTROL</span>
          </div>
        </Link>
      </div>

      {/* UTILITY: VIEW PUBLIC STORE IN NEW TAB */}
      <div className="px-4 py-2.5 border-b border-[#1A1A1A]">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#262626] hover:border-[#D4AF37]/50 rounded-xs text-xs font-mono text-[#CCC] hover:text-white transition-all group"
        >
          <span className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>View Public Store ↗</span>
          </span>
          <ExternalLink className="w-3 h-3 text-[#666] group-hover:text-white" />
        </a>
      </div>

      {/* PWA INSTALL ACTION */}
      <PWAInstallButton variant="sidebar" />
      
      {/* NAVIGATION ITEMS */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-6 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">
          Navigation
        </div>
        <nav className="space-y-0.5">
          {navigation.map((item) => {
            // Optional: visual distinction for restricted items like Settings for non-super-admin
            const isSettingsRestricted = item.href === '/admin/settings' && !hasAccess('canManageSettings');
            const isActive = currentPath === item.href || (item.href !== '/admin/dashboard' && currentPath.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center justify-between px-6 py-3 min-h-[44px] text-xs font-semibold uppercase tracking-wider transition-colors group ${
                  isActive 
                    ? 'bg-[#1A1A1A] text-[#D4AF37] border-l-3 border-[#D4AF37]' 
                    : 'text-[#888] hover:text-white border-l-3 border-transparent hover:bg-[#141414]'
                }`}
              >
                <div className="flex items-center">
                  <item.icon className={`mr-3 h-4 w-4 shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-[#666] group-hover:text-white'}`} />
                  <span>{item.name}</span>
                </div>
                {isSettingsRestricted && (
                  <span className="text-[9px] font-mono text-[#555] group-hover:text-amber-500/70">SA</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* BOTTOM ADMIN PROFILE */}
      <div className="p-4 border-t border-[#1F1F1F] bg-[#0A0A0A] space-y-3">
        <div className="flex items-center justify-between text-[#888] text-[10px] font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SYS ONLINE
          </span>
          <span className="text-[#D4AF37] font-bold bg-amber-950/30 px-1.5 py-0.5 rounded-xs border border-[#D4AF37]/30">
            ADMIN CORE
          </span>
        </div>

        <div className="p-2.5 rounded-xs bg-[#141414] border border-[#222] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xs bg-[#222] border border-[#333] flex items-center justify-center text-xs font-bold text-[#D4AF37] shrink-0">
              {role === 'super_admin' ? 'SA' : role === 'admin' ? 'AD' : 'MG'}
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold text-white uppercase truncate">{user?.name || 'Administrator'}</p>
                <ShieldCheck className="w-3 h-3 text-[#D4AF37] shrink-0" />
              </div>
              <p className="text-[10px] text-[#888] font-mono tracking-tight truncate">
                {role.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { void signOut(); }}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#222] rounded text-[#666] hover:text-red-400 transition-colors shrink-0 cursor-pointer"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
