'use client';

import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  ShoppingBag
} from 'lucide-react';
import { ProductItem } from '@/lib/mock-data';
import { getAdminAuthHeaders, useAdminAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/auth-types';

interface QuickEditProductProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface DrawerInnerProps {
  product: ProductItem;
  onClose: () => void;
  onSaved: () => void;
}

function QuickEditDrawerInner({ product, onClose, onSaved }: DrawerInnerProps) {
  const { role, isAuthenticated, openUnlockModal } = useAdminAuth();

  // Role permissions checks
  const canEditContent = hasPermission(role, 'canEditProductContent');
  const canEditPrice = hasPermission(role, 'canEditProductPrice');
  const canPublish = hasPermission(role, 'canPublishProducts');
  const canEditInventory = hasPermission(role, 'canEditInventory');

  const initialTotalStock = Array.isArray(product.variants) 
    ? product.variants.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0)
    : ((product as any).stockQuantity ?? 0);

  const [name, setName] = useState(product.name || '');
  const [sellingPrice, setSellingPrice] = useState<number | string>(product.price ?? 0);
  const [costPrice, setCostPrice] = useState<number | string>(product.costPrice ?? 0);
  const [category, setCategory] = useState(product.category || 'Outerwear');
  const [collection, setCollection] = useState(product.collection || 'Core Atelier');
  const [availabilityMessage, setAvailabilityMessage] = useState(product.availabilityMessage || '');
  const [featured, setFeatured] = useState(Boolean(product.featured));
  const [published, setPublished] = useState(Boolean(product.published));
  const [stockQuantity, setStockQuantity] = useState<number | string>(initialTotalStock);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openUnlockModal();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const headers = await getAdminAuthHeaders();

      // Build payload based strictly on permitted fields
      const payload: Record<string, any> = {
        id: product.id,
      };

      if (canEditContent) {
        payload.name = name.trim();
        payload.category = category;
        payload.collection = collection;
        payload.availability_message = availabilityMessage.trim();
      }

      if (canEditPrice) {
        payload.selling_price = Number(sellingPrice) || 0;
        if (costPrice !== undefined && costPrice !== '') {
          payload.cost_price = Number(costPrice) || 0;
        }
      }

      if (canPublish) {
        payload.featured = featured;
        payload.published = published;
        payload.status = published ? 'active' : 'draft';
      }

      if (canEditInventory && Array.isArray(product.variants) && product.variants.length > 0) {
        // Distribute stock across variants
        const totalNum = Math.max(0, Number(stockQuantity) || 0);
        const perVar = Math.floor(totalNum / product.variants.length);
        const remainder = totalNum % product.variants.length;

        payload.variants = product.variants.map((v, idx) => ({
          ...v,
          stock_quantity: perVar + (idx === 0 ? remainder : 0),
        }));
      }

      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to update product via quick edit');
      } else {
        setSuccessMsg('Product updated successfully!');
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error updating product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-[#0F0F0F] border-l border-[#262626] h-full shadow-2xl z-10 flex flex-col font-mono animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#222] bg-[#141414] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-white">Quick Product Edit</h2>
            </div>
            <p className="text-[10px] text-[#888] mt-0.5">SKU: {product.sku || product.id}</p>
          </div>

          <button onClick={onClose} className="text-[#888] hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-[10px] uppercase text-[#888] font-bold mb-1">
              Product Name {!canEditContent && '(Read-Only for Role)'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditContent}
              className="w-full bg-[#161616] border border-[#333] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
              required
            />
          </div>

          {/* Pricing Section (SUPER ADMIN ONLY) */}
          <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-[#D4AF37]">Pricing & Cost</span>
              {!canEditPrice && (
                <span className="text-[9px] text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Super Admin Only
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] uppercase text-[#888] mb-1">Selling Price (ZAR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  disabled={!canEditPrice}
                  className="w-full bg-[#0A0A0A] border border-[#333] p-2 text-xs font-bold text-[#D4AF37] focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase text-[#888] mb-1">Cost Price (ZAR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  disabled={!canEditPrice}
                  className="w-full bg-[#0A0A0A] border border-[#333] p-2 text-xs font-bold text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
                />
              </div>
            </div>
          </div>

          {/* Category & Collection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-[#888] font-bold mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!canEditContent}
                className="w-full bg-[#161616] border border-[#333] p-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#888] font-bold mb-1">Collection</label>
              <input
                type="text"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                disabled={!canEditContent}
                className="w-full bg-[#161616] border border-[#333] p-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Availability Message */}
          <div>
            <label className="block text-[10px] uppercase text-[#888] font-bold mb-1">Availability Message / Teaser</label>
            <input
              type="text"
              value={availabilityMessage}
              onChange={(e) => setAvailabilityMessage(e.target.value)}
              disabled={!canEditContent}
              placeholder="e.g. Ships in 2-3 business days"
              className="w-full bg-[#161616] border border-[#333] p-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
            />
          </div>

          {/* Inventory Quantity (Operations & Super Admin) */}
          <div>
            <label className="block text-[10px] uppercase text-[#888] font-bold mb-1">
              Total Stock Quantity {!canEditInventory && '(Operations / Super Admin Only)'}
            </label>
            <input
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              disabled={!canEditInventory}
              className="w-full bg-[#161616] border border-[#333] p-2 text-xs font-bold text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
            />
          </div>

          {/* Publishing Controls (SUPER ADMIN ONLY) */}
          <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-white">Publishing & Visibility</span>
              {!canPublish && (
                <span className="text-[9px] text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Super Admin Only
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-[#AAA]">Published / Active</span>
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                disabled={!canPublish}
                className="w-4 h-4 accent-[#D4AF37] cursor-pointer disabled:opacity-40"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#AAA]">Featured on Homepage</span>
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                disabled={!canPublish}
                className="w-4 h-4 accent-[#D4AF37] cursor-pointer disabled:opacity-40"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#222] bg-[#141414] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#222] hover:bg-[#333] text-white text-xs font-bold uppercase"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-black" />
                <span>Save Quick Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminQuickEditProduct({ product, isOpen, onClose, onSaved }: QuickEditProductProps) {
  if (!isOpen || !product) return null;

  return (
    <QuickEditDrawerInner 
      key={product.id} 
      product={product} 
      onClose={onClose} 
      onSaved={onSaved} 
    />
  );
}
