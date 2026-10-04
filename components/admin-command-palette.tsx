'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  ShoppingBag, 
  Package, 
  Tags, 
  Layers, 
  BarChart3, 
  ImageIcon, 
  UserCheck, 
  Settings, 
  ArrowRight,
  Sparkles,
  Command,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Kanban,
  TrendingUp,
  Bell
} from 'lucide-react';
import { getAdminAuthHeaders, useAdminAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/auth-types';

interface SearchResult {
  id: string;
  type: 'product' | 'order' | 'collection' | 'category';
  title: string;
  subtitle?: string;
  status?: string;
  href: string;
  badgeColor?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminCommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { role, isAuthenticated } = useAdminAuth();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setQuery('');
        setResults([]);
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open
          const event = new CustomEvent('veritas_open_command_palette');
          window.dispatchEvent(event);
        }
      }
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search API fetch
  const executeSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          setResults(data.results);
        } else {
          setResults([]);
        }
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 0) {
        void executeSearch(query);
      } else {
        setResults([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  if (!isOpen) return null;

  // Filter Quick Commands by Role Permissions (Fail Closed for Unknown Roles)
  const isSuper = role === 'super_admin';
  
  const quickActions = [
    {
      id: 'cmd-analytics',
      title: 'Open Store Analytics & Conversion Funnel',
      category: 'Analytics & Intelligence',
      icon: TrendingUp,
      href: '/admin/analytics',
      allowed: hasPermission(role, 'canViewSales'),
    },
    {
      id: 'cmd-notifications',
      title: 'Open Internal Notification Centre',
      category: 'Operations Attention',
      icon: Bell,
      href: '/admin/notifications',
      allowed: true,
    },
    {
      id: 'cmd-add-product',
      title: 'Add New Product',
      category: 'Product Actions',
      icon: ShoppingBag,
      href: '/admin/products/new',
      allowed: hasPermission(role, 'canCreateProducts'),
    },
    {
      id: 'cmd-orders-kanban',
      title: 'Open Order Kanban Workflow',
      category: 'Orders & Dispatch',
      icon: Kanban,
      href: '/admin/orders/kanban',
      allowed: hasPermission(role, 'canViewOrders'),
    },
    {
      id: 'cmd-view-orders',
      title: 'View Orders Table',
      category: 'Orders & Dispatch',
      icon: Tags,
      href: '/admin/orders',
      allowed: hasPermission(role, 'canViewOrders'),
    },
    {
      id: 'cmd-view-inventory',
      title: 'View Variant Inventory & Low Stock Alerts',
      category: 'Inventory',
      icon: Package,
      href: '/admin/inventory',
      allowed: hasPermission(role, 'canViewInventory'),
    },
    {
      id: 'cmd-view-products',
      title: 'View Products Master List',
      category: 'Catalog',
      icon: ShoppingBag,
      href: '/admin/products',
      allowed: hasPermission(role, 'canViewProducts'),
    },
    {
      id: 'cmd-view-collections',
      title: 'Manage Collections',
      category: 'Catalog',
      icon: Layers,
      href: '/admin/collections',
      allowed: hasPermission(role, 'canViewCollections'),
    },
    {
      id: 'cmd-view-categories',
      title: 'Manage Categories',
      category: 'Catalog',
      icon: Tags,
      href: '/admin/categories',
      allowed: hasPermission(role, 'canViewCategories'),
    },
    {
      id: 'cmd-view-media',
      title: 'Open Media Library',
      category: 'Assets',
      icon: ImageIcon,
      href: '/admin/media',
      allowed: hasPermission(role, 'canViewMedia'),
    },
    {
      id: 'cmd-view-sales',
      title: 'View Sales & Financial Reports',
      category: 'Analytics',
      icon: BarChart3,
      href: '/admin/sales',
      allowed: hasPermission(role, 'canViewSales'),
    },
    {
      id: 'cmd-manage-users',
      title: 'Manage Admin Users & RBAC Roles',
      category: 'Security & Access',
      icon: UserCheck,
      href: '/admin/users',
      allowed: isSuper,
    },
    {
      id: 'cmd-manage-settings',
      title: 'System Settings & Gateway Config',
      category: 'Settings',
      icon: Settings,
      href: '/admin/settings',
      allowed: isSuper,
    },
  ].filter(action => action.allowed);

  const navigateTo = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div className="relative w-full max-w-2xl bg-[#0F0F0F] border border-[#262626] shadow-2xl overflow-hidden rounded-xs z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#222] bg-[#141414] shrink-0">
          <Search className="w-4 h-4 text-[#D4AF37] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, SKUs, orders, collections..."
            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-[#555] font-mono"
          />
          {loading && <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin shrink-0 ml-2" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="text-[#666] hover:text-white ml-2 text-xs font-mono uppercase"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 ml-3 text-[10px] font-mono font-bold bg-[#222] text-[#888] border border-[#333] rounded">
            ESC
          </kbd>
        </div>

        {/* Palette Content Canvas */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 font-mono">
          {/* SEARCH RESULTS */}
          {query.trim().length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#777] tracking-wider">
                Search Results ({results.length})
              </div>
              {results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.href)}
                      className="w-full text-left p-2.5 hover:bg-[#1A1A1A] border border-transparent hover:border-[#333] rounded-xs flex items-center justify-between gap-3 transition-colors group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${item.badgeColor || 'bg-[#222] text-white'}`}>
                            {item.type}
                          </span>
                          <span className="text-xs font-bold text-white group-hover:text-[#D4AF37] truncate">
                            {item.title}
                          </span>
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-[#777] mt-0.5 truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>

                      {item.status && (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-[#888] uppercase bg-[#181818] px-2 py-0.5 rounded border border-[#262626]">
                            {item.status}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : !loading ? (
                <div className="py-8 text-center text-xs text-[#666]">
                  No matching records found for &quot;{query}&quot;.
                </div>
              ) : null}
            </div>
          )}

          {/* QUICK COMMANDS (Always visible or when query is empty) */}
          {query.trim().length === 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#777] tracking-wider flex items-center justify-between">
                <span>Authorized Actions ({role ? role.replace('_', ' ') : 'RBAC'})</span>
                <span className="text-[9px] text-[#D4AF37]">Role-Aware</span>
              </div>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => navigateTo(action.href)}
                    className="w-full text-left p-2.5 hover:bg-[#1A1A1A] border border-transparent hover:border-[#333] rounded-xs flex items-center justify-between gap-3 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-[#181818] border border-[#262626] rounded group-hover:border-[#D4AF37]/40">
                        <action.icon className="w-4 h-4 text-[#888] group-hover:text-[#D4AF37]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-[#D4AF37]">
                          {action.title}
                        </div>
                        <div className="text-[10px] text-[#666]">
                          {action.category}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#555] group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#121212] border-t border-[#222] flex items-center justify-between text-[10px] text-[#666] font-mono shrink-0">
          <div className="flex items-center gap-2">
            <Command className="w-3 h-3 text-[#D4AF37]" />
            <span>VERITAS Admin Command Engine</span>
          </div>
          <div>
            <span>Press <kbd className="text-white">Ctrl+K</kbd> to toggle anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
