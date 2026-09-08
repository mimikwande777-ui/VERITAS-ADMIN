'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Download, 
  Save, 
  Sparkles,
  SlidersHorizontal,
  Boxes,
  ArrowRight,
  RefreshCw,
  Minus,
  Unlock,
  Lock
} from 'lucide-react';
import { InventoryItem, calculateStockStatus, mockProducts, ProductItem } from '@/lib/mock-data';
import { getStoredProducts, persistProducts, getInventoryFromProducts } from '@/lib/product-store';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { fetchSupabaseProducts } from '@/lib/supabase/products';
import { 
  updateVariantStockInSupabase, 
  adjustVariantStockInSupabase, 
  addVariantToSupabase,
  batchUpdateVariantStockInSupabase 
} from '@/lib/supabase/inventory';
import { usePWA } from '@/hooks/use-pwa';
import { useAdminAuth } from '@/lib/auth-context';

export default function InventoryPage() {
  const { isAuthenticated, openUnlockModal } = useAdminAuth();
  const { isOnline } = usePWA();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [originalItems, setOriginalItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAddingVariant, setIsAddingVariant] = useState(false);

  // Selected product ID for adding variant
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newColor, setNewColor] = useState('Black');
  const [newSize, setNewSize] = useState('M');
  const [newQty, setNewQty] = useState(0);
  const [newThreshold, setNewThreshold] = useState(5);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured()) {
        const supaProducts = await fetchSupabaseProducts();
        setProducts(supaProducts);
        const invList = getInventoryFromProducts(supaProducts);
        setItems(invList);
        setOriginalItems(invList);
        if (supaProducts.length > 0) {
          setSelectedProductId(prev => prev || supaProducts[0].id);
        }
        return;
      }
      const loaded = getStoredProducts([]);
      setProducts(loaded);
      const invList = getInventoryFromProducts(loaded);
      setItems(invList);
      setOriginalItems(invList);
      if (loaded.length > 0) {
        setSelectedProductId(prev => prev || loaded[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
      const msg = err?.message || 'Failed to load inventory from database.';
      setError(msg);
      showToast(`Failed to load inventory: ${msg}`, 'error');
      setItems([]);
      setOriginalItems([]);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    queueMicrotask(async () => {
      if (mounted) {
        await loadData(true);
      }
    });

    const handleUpdate = () => {
      if (mounted) {
        loadData(false);
      }
    };

    const handleAuthChange = () => {
      if (mounted) {
        loadData(false);
      }
    };

    window.addEventListener('veritas_products_updated', handleUpdate);
    window.addEventListener('veritas_admin_auth_changed', handleAuthChange);
    return () => {
      mounted = false;
      window.removeEventListener('veritas_products_updated', handleUpdate);
      window.removeEventListener('veritas_admin_auth_changed', handleAuthChange);
    };
  }, []);

  // Update quantity and recalculate status automatically in local UI state
  const handleQuantityChange = (id: string, newQuantity: number) => {
    const qty = Math.max(0, newQuantity);
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextStatus = calculateStockStatus(qty, item.lowStockThreshold);
        return { ...item, quantity: qty, status: nextStatus };
      }
      return item;
    }));
  };

  // Update threshold and recalculate status automatically
  const handleThresholdChange = (id: string, newThreshold: number) => {
    const threshold = Math.max(1, newThreshold);
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextStatus = calculateStockStatus(item.quantity, threshold);
        return { ...item, lowStockThreshold: threshold, status: nextStatus };
      }
      return item;
    }));
  };

  // Quick atomic stock delta (+1, -1, +5, -5) directly persisted to database
  const handleQuickDelta = async (item: InventoryItem, delta: number) => {
    if (!isAuthenticated) {
      openUnlockModal();
      showToast('Admin authorization required to modify inventory stock.', 'error');
      return;
    }
    const variantId = item.variantId || (item.id.startsWith('INV-') ? item.id.replace(/^INV-/, '') : item.id);
    if (!variantId) {
      showToast('Error: Variant ID not found for this inventory item.', 'error');
      return;
    }
    setRowSavingId(item.id);

    if (isSupabaseConfigured()) {
      const result = await adjustVariantStockInSupabase(variantId, delta);
      setRowSavingId(null);

      if (result.success && result.newStock !== undefined) {
        const nextStatus = calculateStockStatus(result.newStock, item.lowStockThreshold);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: result.newStock!, status: nextStatus } : i));
        setOriginalItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: result.newStock!, status: nextStatus } : i));
        showToast(`Stock updated & verified in database: ${item.product} (${item.color}/${item.size}) = ${result.newStock} units`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
      } else {
        const errorMsg = result.error?.includes('Admin authorization required') || result.error?.includes('Unauthorized') || result.error?.includes('Forbidden')
          ? 'Admin authorization required'
          : `Failed to adjust stock: ${result.error}`;
        if (result.error?.includes('Admin authorization required') || result.error?.includes('Unauthorized')) {
          openUnlockModal();
        }
        showToast(errorMsg, 'error');
      }
      return;
    }

    // Local fallback
    const targetQty = Math.max(0, item.quantity + delta);
    handleQuantityChange(item.id, targetQty);
    setRowSavingId(null);
  };

  // Save single variant stock immediately to Supabase
  const handleSaveSingleRow = async (item: InventoryItem) => {
    if (!isAuthenticated) {
      openUnlockModal();
      showToast('Admin authorization required to modify inventory stock.', 'error');
      return;
    }
    const variantId = item.variantId || (item.id.startsWith('INV-') ? item.id.replace(/^INV-/, '') : item.id);
    if (!variantId) {
      showToast('Error: Variant ID not found for this inventory item.', 'error');
      return;
    }
    setRowSavingId(item.id);

    if (isSupabaseConfigured()) {
      const result = await updateVariantStockInSupabase(variantId, item.quantity, item.lowStockThreshold);
      setRowSavingId(null);

      if (result.success) {
        setOriginalItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: item.quantity, lowStockThreshold: item.lowStockThreshold } : i));
        showToast(`Stock saved & verified in database: ${item.product} (${item.color}/${item.size}) = ${item.quantity} units`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
      } else {
        // Revert to original stock on error
        const orig = originalItems.find(o => o.id === item.id);
        if (orig) {
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: orig.quantity, status: orig.status } : i));
        }
        const errorMsg = result.error?.includes('Admin authorization required') || result.error?.includes('Unauthorized') || result.error?.includes('Forbidden')
          ? 'Admin authorization required'
          : `Supabase update error: ${result.error}`;
        if (result.error?.includes('Admin authorization required') || result.error?.includes('Unauthorized')) {
          openUnlockModal();
        }
        showToast(errorMsg, 'error');
      }
      return;
    }

    setRowSavingId(null);
    showToast(`Updated local stock for ${item.product}`);
  };

  // Save all changes back to Supabase
  const handleSaveAll = async () => {
    if (!isAuthenticated) {
      openUnlockModal();
      showToast('Admin authorization required to modify inventory stock.', 'error');
      return;
    }
    setIsSaving(true);
    if (isSupabaseConfigured()) {
      const updates = items.map(item => ({
        variantId: item.variantId || item.id.replace(/^INV-/, ''),
        quantity: item.quantity,
        threshold: item.lowStockThreshold,
      }));

      const batchResult = await batchUpdateVariantStockInSupabase(updates);
      setIsSaving(false);

      if (batchResult.success) {
        showToast(`Successfully saved ${batchResult.updatedCount} variant stock quantities to Supabase.`);
        const refreshed = await fetchSupabaseProducts();
        if (refreshed) {
          setProducts(refreshed);
          const inv = getInventoryFromProducts(refreshed);
          setItems(inv);
          setOriginalItems(inv);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
      } else {
        showToast(`Saved ${batchResult.updatedCount} items, but encountered errors: ${batchResult.errors.join('; ')}`, 'error');
      }
      return;
    }

    // Local state fallback
    const currentProducts = getStoredProducts(mockProducts);
    const updatedProducts = currentProducts.map(prod => {
      if (!prod.variants || prod.variants.length === 0) return prod;
      const updatedVariants = prod.variants.map(variant => {
        const matchingItem = items.find(
          i => i.variantId === variant.id || i.id === variant.id || i.id === `INV-${variant.sku || variant.id}`
        );
        if (matchingItem) {
          const rawStatus = matchingItem.status.toUpperCase() as 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
          return {
            ...variant,
            stockQuantity: matchingItem.quantity,
            lowStockThreshold: matchingItem.lowStockThreshold,
            status: rawStatus
          };
        }
        return variant;
      });
      return { ...prod, variants: updatedVariants };
    });

    persistProducts(updatedProducts);
    setProducts(updatedProducts);
    setIsSaving(false);
    showToast('Inventory records and variant stock counts synchronized to product catalog.');
  };

  // Add new variant inventory record
  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openUnlockModal();
      showToast('Admin authorization required to add new inventory variants.', 'error');
      return;
    }
    const targetProduct = products.find(p => p.id === selectedProductId);
    if (!targetProduct) {
      showToast('Please select an existing product.', 'error');
      return;
    }

    if (isSupabaseConfigured()) {
      const generatedSku = `${targetProduct.sku || 'VRT'}-${newColor.slice(0, 3).toUpperCase()}-${newSize}`;
      const newVar = await addVariantToSupabase({
        product_id: targetProduct.id,
        sku: generatedSku,
        colour: newColor,
        size: newSize,
        stock_quantity: newQty,
        low_stock_threshold: newThreshold,
      });

      if (newVar) {
        showToast(`Created variant (${newColor}, ${newSize}) with ${newQty} units in Supabase.`);
        setIsAddingVariant(false);
        await loadData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
      } else {
        showToast('Failed to insert new variant record into Supabase.', 'error');
      }
      return;
    }

    const newVariantId = `var-${Date.now().toString(36)}-${items.length + 1}`;
    const calculatedStatus = calculateStockStatus(newQty, newThreshold);
    const rawStatus = calculatedStatus.toUpperCase() as 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';

    const newVariant = {
      id: newVariantId,
      colour: newColor,
      size: newSize,
      sku: `${targetProduct.sku}-${newColor.slice(0, 3).toUpperCase()}-${newSize}`,
      stockQuantity: newQty,
      lowStockThreshold: newThreshold,
      status: rawStatus
    };

    const updatedProducts = products.map(p => {
      if (p.id === targetProduct.id) {
        const currentVars = p.variants || [];
        return {
          ...p,
          variants: [...currentVars, newVariant]
        };
      }
      return p;
    });

    persistProducts(updatedProducts);
    setProducts(updatedProducts);
    setItems(getInventoryFromProducts(updatedProducts));
    setIsAddingVariant(false);
    showToast(`Added variant (${newColor}, ${newSize}) to ${targetProduct.name}`);
  };

  // Export inventory as CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      showToast('No inventory records to export.', 'error');
      return;
    }
    const header = 'ID,Variant_UUID,Product,Color,Size,Quantity,LowStockThreshold,Status\n';
    const rows = items.map(i => `"${i.id}","${i.variantId || ''}","${i.product}","${i.color}","${i.size}",${i.quantity},${i.lowStockThreshold},"${i.status}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veritas_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('Inventory CSV exported.');
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.size.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'in_stock') matchesStatus = item.status === 'In Stock';
    if (statusFilter === 'low_stock') matchesStatus = item.status === 'Low Stock';
    if (statusFilter === 'out_of_stock') matchesStatus = item.status === 'Out of Stock';

    return matchesSearch && matchesStatus;
  });

  const totalVariants = items.length;
  const lowStockCount = items.filter(i => i.status === 'Low Stock').length;
  const outOfStockCount = items.filter(i => i.status === 'Out of Stock').length;
  const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 border px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in ${
          notification.type === 'error'
            ? 'bg-[#200A0A] border-red-500/60 text-red-200'
            : 'bg-[#161616] border-[#D4AF37] text-white'
        }`}>
          {notification.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          )}
          <span className="text-xs font-medium font-mono">{notification.message}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Variant Inventory</h1>
          <p className="text-[11px] sm:text-xs text-[#888] font-mono mt-0.5 sm:mt-1">
            REAL-TIME STOCK LEVELS & DISPATCH
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => { void loadData(true); }}
            disabled={loading}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 border border-[#333] bg-[#111] hover:bg-[#1A1A1A] text-[#888] hover:text-white rounded transition-colors active:scale-95"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          </button>
          <button 
            type="button"
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="min-h-[44px] flex-1 sm:flex-initial px-3 sm:px-4 py-2 border border-[#333] text-xs font-bold uppercase tracking-wider bg-[#111] hover:bg-[#181818] text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-[#888]" />
            Export CSV
          </button>
          <button 
            type="button"
            onClick={() => setIsAddingVariant(true)}
            disabled={products.length === 0}
            className="min-h-[44px] flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Variant
          </button>
        </div>
      </div>

      {/* SUMMARY BENTO METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-5">
          <h3 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Tracked</h3>
          <p className="text-2xl sm:text-3xl font-light text-white font-mono">{totalVariants}</p>
          <p className="text-[10px] sm:text-[11px] text-[#666] font-mono mt-0.5 sm:mt-1">{totalUnits} units</p>
        </div>

        <div className="bg-[#111] border border-amber-900/30 p-3 sm:p-5 bg-gradient-to-br from-[#111] to-[#1a150c]">
          <h3 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">Low Stock</h3>
          <p className="text-2xl sm:text-3xl font-light text-amber-400 font-mono">{lowStockCount}</p>
          <p className="text-[10px] sm:text-[11px] text-amber-400/70 font-mono mt-0.5 sm:mt-1">Needs restock</p>
        </div>

        <div className="bg-[#111] border border-red-900/30 p-3 sm:p-5 bg-gradient-to-br from-[#111] to-[#1a0f0f]">
          <h3 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">Out of Stock</h3>
          <p className="text-2xl sm:text-3xl font-light text-red-400 font-mono">{outOfStockCount}</p>
          <p className="text-[10px] sm:text-[11px] text-red-400/70 font-mono mt-0.5 sm:mt-1">0 units left</p>
        </div>

        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-5">
          <h3 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Threshold</h3>
          <p className="text-2xl sm:text-3xl font-light text-white font-mono">5 units</p>
          <p className="text-[10px] sm:text-[11px] text-[#666] font-mono mt-0.5 sm:mt-1">Reorder trigger</p>
        </div>
      </div>

      {/* INVENTORY TABLE */}
      <div className="bg-[#111] border border-[#1F1F1F] shadow-sm">
        <div className="p-3 sm:p-4 border-b border-[#1F1F1F] flex flex-col md:flex-row gap-3 sm:gap-4 justify-between items-center bg-[#151515]">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search SKU variant, product, color, size..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 text-base md:text-xs bg-[#0A0A0A] text-white border border-[#333] focus:outline-none focus:border-[#D4AF37] placeholder-[#555] font-mono rounded-none"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto min-h-[44px] px-3 py-2 bg-[#0A0A0A] border border-[#333] text-base md:text-xs text-white uppercase tracking-wider focus:outline-none focus:border-[#D4AF37] font-mono rounded-none"
            >
              <option value="all">All Availability States</option>
              <option value="in_stock">In Stock Only</option>
              <option value="low_stock">Low Stock Only</option>
              <option value="out_of_stock">Out of Stock Only</option>
            </select>
          </div>
        </div>

        {/* 1. MOBILE RESPONSIVE STACKED CARDS (< md) */}
        <div className="block md:hidden divide-y divide-[#1F1F1F]">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-[#888]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37] mx-auto mb-2" />
              Querying Supabase product_variants table...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-red-400 font-mono bg-red-950/20 space-y-1">
              <p className="font-bold text-sm uppercase text-red-300">Unable to load inventory</p>
              <p className="text-[#888]">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#888] font-mono">
              NO INVENTORY TRACKED YET
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#666] font-mono">
              NO INVENTORY VARIANTS MATCH THE CURRENT SEARCH
            </div>
          ) : (
            filteredItems.map((item) => {
              const isRowSaving = rowSavingId === item.id;
              return (
                <div key={item.id} className="p-4 space-y-3 bg-[#111]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/admin/products/${item.productId}`} className="font-bold text-sm text-white uppercase hover:text-[#D4AF37] transition-colors block">
                        {item.product}
                      </Link>
                      <div className="text-[11px] font-mono text-[#888] space-x-2">
                        <span>SKU: {item.id}</span>
                        <span>•</span>
                        <span>{item.color}</span>
                        <span>•</span>
                        <span className="text-[#D4AF37] font-bold">Size {item.size}</span>
                      </div>
                    </div>

                    <span className={`inline-flex px-2 py-0.5 text-[9px] uppercase font-mono font-bold rounded shrink-0 ${
                      item.status === 'In Stock' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 
                      item.status === 'Low Stock' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' : 
                      'bg-red-950/60 text-red-400 border border-red-800/40'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  {/* Quick delta stepper */}
                  <div className="flex items-center justify-between bg-[#161616] p-2 sm:p-2.5 rounded-xs border border-[#222]">
                    <span className="text-[10px] font-mono uppercase text-[#888]">Quick Delta:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isRowSaving || item.quantity <= 0 || !isOnline}
                        onClick={() => handleQuickDelta(item, -1)}
                        className="min-w-[44px] min-h-[44px] bg-[#222] hover:bg-[#2A2A2A] active:scale-95 border border-[#333] text-[#AAA] rounded text-xs font-mono disabled:opacity-30 flex items-center justify-center disabled:cursor-not-allowed"
                        aria-label="Decrease stock by 1"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        disabled={isRowSaving || !isOnline}
                        onClick={() => handleQuickDelta(item, 1)}
                        className="min-w-[44px] min-h-[44px] bg-[#222] hover:bg-[#2A2A2A] active:scale-95 border border-[#333] text-[#AAA] rounded text-xs font-mono disabled:opacity-30 flex items-center justify-center disabled:cursor-not-allowed"
                        aria-label="Increase stock by 1"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        disabled={isRowSaving || !isOnline}
                        onClick={() => handleQuickDelta(item, 5)}
                        className="min-w-[44px] min-h-[44px] bg-[#222] hover:bg-[#2A2A2A] active:scale-95 border border-[#333] text-[#D4AF37] rounded text-xs font-mono disabled:opacity-30 flex items-center justify-center disabled:cursor-not-allowed"
                        aria-label="Increase stock by 5"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* Quantity and Threshold Inputs */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-[#161616] p-2 rounded-xs border border-[#222]">
                      <label className="text-[9px] uppercase text-[#777] block mb-1">Available Qty</label>
                      <input 
                        type="number" 
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                        disabled={!isOnline}
                        className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] px-2 py-1 text-center text-base md:text-sm font-bold text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                      />
                    </div>

                    <div className="bg-[#161616] p-2 rounded-xs border border-[#222]">
                      <label className="text-[9px] uppercase text-[#777] block mb-1">Alert Threshold</label>
                      <input 
                        type="number" 
                        min="1"
                        value={item.lowStockThreshold}
                        onChange={(e) => handleThresholdChange(item.id, parseInt(e.target.value) || 1)}
                        disabled={!isOnline}
                        className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#262626] px-2 py-1 text-center text-base md:text-sm text-[#888] focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      disabled={isRowSaving || !isOnline}
                      onClick={() => handleSaveSingleRow(item)}
                      className="w-full min-h-[44px] bg-[#1A1A1A] hover:bg-[#252525] active:scale-98 border border-[#333] hover:border-[#D4AF37] text-white text-xs font-mono uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {!isOnline ? 'Offline' : isRowSaving ? 'Saving to Supabase...' : 'Save Variant Stock'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. DESKTOP TABULAR VIEW (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-[#666] uppercase bg-[#0A0A0A] tracking-wider border-b border-[#1F1F1F] font-mono">
              <tr>
                <th className="px-6 py-4 font-bold">Variant SKU</th>
                <th className="px-6 py-4 font-bold">Product Item</th>
                <th className="px-6 py-4 font-bold">Colorway</th>
                <th className="px-6 py-4 font-bold text-center">Size</th>
                <th className="px-6 py-4 font-bold text-center">Quick Adjust</th>
                <th className="px-6 py-4 font-bold text-right">Available QTY</th>
                <th className="px-6 py-4 font-bold text-right">Alert Threshold</th>
                <th className="px-6 py-4 font-bold">Stock Status (Auto)</th>
                <th className="px-6 py-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-xs font-mono text-[#888]">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37] mx-auto mb-2" />
                    Querying Supabase product_variants table...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center bg-red-950/20">
                    <div className="max-w-md mx-auto space-y-3 text-red-400 font-mono">
                      <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-red-300">Unable to load inventory</h3>
                      <p className="text-xs text-[#888] font-mono">
                        {error}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#777]">
                        <Boxes className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">NO INVENTORY TRACKED YET</h3>
                      <p className="text-xs text-[#888] font-mono">
                        Add products with size and colour variants in the Product Catalog to track inventory levels.
                      </p>
                      <div className="pt-2">
                        <Link 
                          href="/admin/products/new"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Product
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-xs text-[#666] font-mono">
                    NO INVENTORY VARIANTS MATCH THE CURRENT SEARCH
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isRowSaving = rowSavingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-[#151515] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-[#888] font-bold">
                        <div>{item.id}</div>
                        {item.variantId && (
                          <div className="text-[9px] text-[#555] truncate max-w-[120px] font-normal" title={item.variantId}>
                            {item.variantId.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-white tracking-wide">
                        <Link href={`/admin/products/${item.productId}`} className="hover:text-[#D4AF37] transition-colors">
                          {item.product}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-[#BBB] text-xs font-mono">{item.color}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 bg-[#1C1C1C] border border-[#333] text-white font-mono text-xs font-bold rounded">
                          {item.size}
                        </span>
                      </td>
                      
                      {/* Quick Adjust Buttons (+1, -1, +5) */}
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isRowSaving || item.quantity <= 0 || !isOnline}
                            onClick={() => handleQuickDelta(item, -1)}
                            className="p-1 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-[#AAA] hover:text-white rounded text-[10px] font-mono disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Decrease by 1"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            disabled={isRowSaving || !isOnline}
                            onClick={() => handleQuickDelta(item, 1)}
                            className="p-1 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-[#AAA] hover:text-white rounded text-[10px] font-mono disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Increase by 1"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            disabled={isRowSaving || !isOnline}
                            onClick={() => handleQuickDelta(item, 5)}
                            className="p-1 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-[#D4AF37] hover:text-white rounded text-[10px] font-mono disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Increase by 5"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <input 
                          type="number" 
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                          disabled={!isOnline}
                          className="w-20 bg-[#0A0A0A] border border-[#333] p-1.5 text-right text-xs font-mono font-bold text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input 
                          type="number" 
                          min="1"
                          value={item.lowStockThreshold}
                          onChange={(e) => handleThresholdChange(item.id, parseInt(e.target.value) || 1)}
                          disabled={!isOnline}
                          className="w-16 bg-[#0A0A0A] border border-[#262626] p-1.5 text-right text-xs font-mono text-[#888] focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.status === 'Low Stock' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {item.status === 'Out of Stock' && <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          {item.status === 'In Stock' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          <span className={`inline-flex px-2.5 py-0.5 text-[10px] uppercase font-mono font-bold rounded ${
                            item.status === 'In Stock' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 
                            item.status === 'Low Stock' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' : 
                            'bg-red-950/60 text-red-400 border border-red-800/40'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          disabled={isRowSaving || !isOnline}
                          onClick={() => handleSaveSingleRow(item)}
                          className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] hover:border-[#D4AF37] text-white text-[10px] font-mono uppercase tracking-wider rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Save single row to Supabase"
                        >
                          {!isOnline ? 'Offline' : isRowSaving ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-[#1F1F1F] flex justify-between items-center bg-[#151515]">
          <span className="text-xs font-mono text-[#888]">
            Showing {filteredItems.length} of {items.length} variants
          </span>
          <button 
            onClick={handleSaveAll}
            disabled={items.length === 0 || isSaving || !isOnline}
            className="px-6 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            {!isOnline ? 'Offline' : isSaving ? 'Saving to Database...' : 'Save All Stock Adjustments'}
          </button>
        </div>
      </div>

      {/* ADD VARIANT MODAL */}
      {isAddingVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111] border border-[#262626] w-full max-w-lg shadow-2xl p-6 rounded">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-4 mb-6">
              <h2 className="text-base font-bold uppercase tracking-widest text-white">Add New Variant Track</h2>
              <button onClick={() => setIsAddingVariant(false)} className="text-[#666] hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVariant} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-wider text-[#888] mb-1">Product</label>
                <select 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={!isOnline}
                  className="w-full bg-[#0A0A0A] border border-[#333] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono disabled:opacity-50"
                  required
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider text-[#888] mb-1">Colorway</label>
                  <input 
                    type="text" 
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="e.g. Black"
                    disabled={!isOnline}
                    className="w-full bg-[#0A0A0A] border border-[#333] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono disabled:opacity-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider text-[#888] mb-1">Size</label>
                  <select 
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    disabled={!isOnline}
                    className="w-full bg-[#0A0A0A] border border-[#333] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono disabled:opacity-50"
                  >
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="3XL">3XL</option>
                    <option value="OS">OS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider text-[#888] mb-1">Initial Quantity</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newQty}
                    onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                    disabled={!isOnline}
                    className="w-full bg-[#0A0A0A] border border-[#333] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono disabled:opacity-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider text-[#888] mb-1">Low Stock Alert Threshold</label>
                  <input 
                    type="number" 
                    min="1"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(parseInt(e.target.value) || 1)}
                    disabled={!isOnline}
                    className="w-full bg-[#0A0A0A] border border-[#333] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1F1F1F]">
                <button 
                  type="button" 
                  onClick={() => setIsAddingVariant(false)}
                  className="px-4 py-2 border border-[#333] text-xs font-mono uppercase text-[#888] hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!isOnline}
                  className="px-5 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {!isOnline ? 'Offline' : 'Confirm & Track Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
