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
  UserCheck,
  ShieldCheck, 
  Globe, 
  ExternalLink, 
  LogOut, 
  Lock, 
  Unlock 
} from 'lucide-react';
import { useAdminAuth } from '@/lib/auth-context';
import { PWAInstallButton } from '@/components/pwa-install-button';
import { PermissionString } from '@/lib/auth-types';

interface NavItemConfig {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: PermissionString;
  superAdminOnly?: boolean;
}

const ALL_NAVIGATION_ITEMS: NavItemConfig[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/admin/products', icon: ShoppingBag, requiredPermission: 'canViewProducts' },
  { name: 'Inventory', href: '/admin/inventory', icon: Package, requiredPermission: 'canViewInventory' },
  { name: 'Orders & OTC', href: '/admin/orders', icon: Tags, requiredPermission: 'canViewOrders' },
  { name: 'Sales & Reports', href: '/admin/sales', icon: BarChart3, requiredPermission: 'canViewSales' },
  { name: 'Collections', href: '/admin/collections', icon: Layers, requiredPermission: 'canViewCollections' },
  { name: 'Categories', href: '/admin/categories', icon: Tags, requiredPermission: 'canViewCategories' },
  { name: 'Customers', href: '/admin/customers', icon: Users, requiredPermission: 'canViewCustomers' },
  { name: 'Discounts', href: '/admin/discounts', icon: TicketPercent, requiredPermission: 'canViewDiscounts' },
  { name: 'Media Library', href: '/admin/media', icon: ImageIcon, requiredPermission: 'canViewMedia' },
  { name: 'Admin Users', href: '/admin/users', icon: UserCheck, requiredPermission: 'canManageUsers', superAdminOnly: true },
  { name: 'Activity Log', href: '/admin/activity', icon: Activity, requiredPermission: 'canViewActivityLog' },
  { name: 'Settings', href: '/admin/settings', icon: Settings, requiredPermission: 'canManageSettings', superAdminOnly: true },
];

export function AdminSidebar({ currentPath, onNavigate }: { currentPath: string; onNavigate?: () => void }) {
  const { user, role, isAuthenticated, openUnlockModal, signOut, hasAccess } = useAdminAuth();

  // Filter visible items dynamically according to authenticated partner role permissions
  const visibleNavItems = ALL_NAVIGATION_ITEMS.filter((item) => {
    // If not authenticated, show essential dashboard navigation
    if (!isAuthenticated) {
      if (item.superAdminOnly) return false;
      return true;
    }
    if (item.superAdminOnly) {
      return role === 'super_admin';
    }
    if (item.requiredPermission) {
      return hasAccess(item.requiredPermission);
    }
    return true;
  });

  const getRoleInitials = (roleStr?: string | null) => {
    if (!roleStr) return 'AD';
    if (roleStr === 'super_admin') return 'SA';
    if (roleStr === 'operations') return 'OP';
    if (roleStr === 'marketing') return 'MK';
    if (roleStr === 'finance') return 'FN';
    return 'AD';
  };

  const getRoleBadgeColor = (roleStr?: string | null) => {
    if (roleStr === 'super_admin') return 'bg-amber-950/60 text-[#D4AF37] border-[#D4AF37]/40';
    if (roleStr === 'operations') return 'bg-blue-950/60 text-blue-400 border-blue-500/40';
    if (roleStr === 'marketing') return 'bg-purple-950/60 text-purple-300 border-purple-500/40';
    if (roleStr === 'finance') return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
    return 'bg-amber-950/60 text-[#D4AF37] border-[#D4AF37]/40';
  };

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
        <div className="px-6 pb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Navigation</span>
          {isAuthenticated && role && (
            <span className="text-[9px] font-mono text-[#888] uppercase">
              {role.replace('_', ' ')}
            </span>
          )}
        </div>
        <nav className="space-y-0.5">
          {visibleNavItems.map((item) => {
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
                {item.superAdminOnly && (
                  <span className="text-[9px] font-mono text-[#777] bg-[#161616] px-1 py-0.5 rounded border border-[#262626]">
                    SA
                  </span>
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
            <span className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            {isAuthenticated ? 'RBAC ACTIVE' : 'SECURE GATEWAY'}
          </span>
          <span className={`font-bold px-1.5 py-0.5 rounded-xs border text-[9px] font-mono uppercase ${getRoleBadgeColor(role)}`}>
            {isAuthenticated && role ? role.replace('_', ' ') : 'LOCKED'}
          </span>
        </div>

        {isAuthenticated && user ? (
          <div className="p-2.5 rounded-xs bg-[#141414] border border-[#222] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xs bg-[#222] border border-[#333] flex items-center justify-center text-xs font-bold text-[#D4AF37] shrink-0">
                {getRoleInitials(role)}
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-white uppercase truncate">{user?.name || 'Administrator'}</p>
                  <ShieldCheck className="w-3 h-3 text-[#D4AF37] shrink-0" />
                </div>
                <p className="text-[10px] text-[#888] font-mono tracking-tight truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { void signOut(); }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#222] rounded text-[#666] hover:text-red-400 transition-colors shrink-0 cursor-pointer"
              title="Lock Admin / Sign Out"
              aria-label="Lock Admin / Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xs bg-[#141414] border border-[#222] space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-[#888]">
              <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="font-mono text-[11px] text-[#A0A0A0]">Role-Protected Access</span>
            </div>
            <button
              type="button"
              onClick={openUnlockModal}
              className="w-full min-h-[40px] bg-[#D4AF37] hover:bg-[#B3932F] active:scale-[0.99] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 text-black" />
              <span>Unlock Admin</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
