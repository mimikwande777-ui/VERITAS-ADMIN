'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Archive, 
  RotateCcw, 
  Globe, 
  EyeOff, 
  Eye,
  Check, 
  X, 
  Sparkles, 
  Layers, 
  Tag, 
  SlidersHorizontal,
  ExternalLink,
  Copy,
  Trash2,
  Boxes,
  Palette,
  AlertTriangle
} from 'lucide-react';
import { mockProducts, ProductItem, ProductStatus } from '@/lib/mock-data';
import { 
  useProductsState,
  persistProducts, 
  publishProduct,
  unpublishProduct,
  archiveProduct,
  deleteProduct,
  createProduct,
  calculateProfitMetrics, 
  calculateProductTotalStock,
  generateDeterministicId
} from '@/lib/product-store';
import { formatZAR } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';
import { AdminAccessGuard } from '@/components/admin-access-guard';

export default function ProductsPage() {
  const router = useRouter();
  const { products, loading, error } = useProductsState();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Quick Archive / Restore
  const handleToggleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = products.find(p => p.id === id);
    if (!item) return;
    if (item.status === 'ARCHIVED') {
      publishProduct(id);
      showToast(`Product "${item.name}" restored to ACTIVE`);
    } else {
      archiveProduct(id);
      showToast(`Product "${item.name}" moved to ARCHIVED`);
    }
  };

  // Quick Storefront Publish toggle
  const handleTogglePublish = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = products.find(p => p.id === id);
    if (!item) return;
    if (item.published) {
      unpublishProduct(id);
      showToast(`"${item.name}" hidden from storefront`);
    } else {
      publishProduct(id);
      showToast(`"${item.name}" published to storefront`);
    }
  };

  // Duplicate Product
  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = products.find(p => p.id === id);
    if (!item) return;

    const duplicatePayload: Partial<ProductItem> = {
      ...item,
      id: undefined,
      name: `${item.name} (Copy)`,
      slug: `${item.slug}-copy-${generateDeterministicId('cpy')}`,
      sku: `${item.sku}-CPY`,
      status: 'DRAFT',
      published: false,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      variants: (item.variants || []).map(v => ({
        ...v,
        id: generateDeterministicId('var'),
        sku: `${v.sku}-CPY`
      }))
    };

    createProduct(duplicatePayload);
    showToast(`Created duplicate "${duplicatePayload.name}"`);
  };

  // Delete Product
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = products.find(p => p.id === id);
    if (!item) return;
    if (!confirm(`Are you sure you want to permanently delete "${item.name}"?`)) return;

    deleteProduct(id);
    showToast(`Deleted product "${item.name}"`);
  };

  // Filtered products list
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
    
    let matchesStatus = true;
    if (statusTab === 'ACTIVE') matchesStatus = p.status === 'ACTIVE';
    if (statusTab === 'DRAFT') matchesStatus = p.status === 'DRAFT';
    if (statusTab === 'ARCHIVED') matchesStatus = p.status === 'ARCHIVED';

    let matchesCategory = true;
    if (categoryFilter !== 'all') matchesCategory = p.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(products.map(p => p.category)));

  // Counts for status tabs
  const countAll = products.length;
  const countActive = products.filter(p => p.status === 'ACTIVE').length;
  const countDraft = products.filter(p => p.status === 'DRAFT').length;
  const countArchived = products.filter(p => p.status === 'ARCHIVED').length;

  return (
    <AdminAccessGuard requiredPermission="canViewProducts" featureLabel="Product Catalog & Apparel Lines">
      <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161616] border border-[#D4AF37] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
          <span className="text-xs font-medium font-mono">{notification}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Product Catalog</h1>
          <p className="text-[11px] sm:text-xs text-[#888] font-mono mt-0.5 sm:mt-1">
            CENTRAL SOURCE OF TRUTH • ZAR CURRENCY • PRODUCT DATA
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Link 
            href="/admin/products/new"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors shadow-lg shadow-[#D4AF37]/10 active:scale-98"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Product
          </Link>
        </div>
      </div>

      {/* STATUS TABS */}
      <div className="flex items-center gap-1 border-b border-[#1F1F1F] pb-2 overflow-x-auto no-scrollbar whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setStatusTab('ALL')}
          className={`min-h-[44px] px-3.5 sm:px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 shrink-0 ${
            statusTab === 'ALL'
              ? 'border-[#D4AF37] text-[#D4AF37] bg-[#141414]'
              : 'border-transparent text-[#888] hover:text-white'
          }`}
        >
          All ({countAll})
        </button>
        <button
          onClick={() => setStatusTab('ACTIVE')}
          className={`min-h-[44px] px-3.5 sm:px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 shrink-0 ${
            statusTab === 'ACTIVE'
              ? 'border-emerald-500 text-emerald-400 bg-[#141414]'
              : 'border-transparent text-[#888] hover:text-white'
          }`}
        >
          Active ({countActive})
        </button>
        <button
          onClick={() => setStatusTab('DRAFT')}
          className={`min-h-[44px] px-3.5 sm:px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 shrink-0 ${
            statusTab === 'DRAFT'
              ? 'border-amber-500 text-amber-400 bg-[#141414]'
              : 'border-transparent text-[#888] hover:text-white'
          }`}
        >
          Drafts ({countDraft})
        </button>
        <button
          onClick={() => setStatusTab('ARCHIVED')}
          className={`min-h-[44px] px-3.5 sm:px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 shrink-0 ${
            statusTab === 'ARCHIVED'
              ? 'border-red-500 text-red-400 bg-[#141414]'
              : 'border-transparent text-[#888] hover:text-white'
          }`}
        >
          Archived ({countArchived})
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[#111] border border-[#1F1F1F] shadow-sm">
        <div className="p-3 sm:p-4 border-b border-[#1F1F1F] flex flex-col md:flex-row gap-3 sm:gap-4 justify-between items-center bg-[#151515]">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, SKU, tag..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 text-base md:text-xs bg-[#0A0A0A] text-white border border-[#333] focus:outline-none focus:border-[#D4AF37] placeholder-[#555] font-mono rounded-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto min-h-[44px] px-3 py-2 bg-[#0A0A0A] border border-[#333] text-base md:text-xs text-white uppercase tracking-wider focus:outline-none focus:border-[#D4AF37] font-mono rounded-none"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* PRODUCTS TABLE */}
        {/* 1. MOBILE RESPONSIVE STACKED CARDS (< md) */}
        <div className="block md:hidden divide-y divide-[#1F1F1F]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#888] font-mono">
              LOADING PRODUCTS...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-red-400 font-mono bg-red-950/20 space-y-1">
              <p className="font-bold text-sm uppercase text-red-300">Unable to load products</p>
              <p className="text-[#888]">{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#888] font-mono">
              NO PRODUCTS YET
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#666] font-mono">
              NO PRODUCTS MATCH CURRENT SEARCH OR FILTER CRITERIA
            </div>
          ) : (
            filteredProducts.map((product) => {
              const profit = calculateProfitMetrics(product.price, product.costPrice);
              const stockSummary = calculateProductTotalStock(product.variants || []);
              const totalUnits = stockSummary.totalQuantity;
              const primaryImg = product.images?.find(img => img.isPrimary)?.url || product.image;

              return (
                <div 
                  key={product.id} 
                  className="p-4 space-y-3 bg-[#111]"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-20 bg-[#1A1A1A] border border-[#262626] overflow-hidden rounded-xs shrink-0 flex items-center justify-center">
                      {primaryImg ? (
                        <img 
                          src={primaryImg} 
                          alt={product.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#444]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <Link 
                          href={`/admin/products/${product.id}`}
                          className="font-bold text-sm text-white uppercase hover:text-[#D4AF37] transition-colors truncate block"
                        >
                          {product.name}
                        </Link>
                      </div>

                      <div className="text-[11px] font-mono text-[#888] space-x-1.5 truncate">
                        <span>SKU: {product.sku}</span>
                        <span>•</span>
                        <span>{product.category}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-sm font-bold font-mono text-white">
                          {formatZAR(product.price)}
                        </span>
                        <span className={`inline-block px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase rounded border ${
                          product.status === 'ACTIVE' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40' :
                          product.status === 'ARCHIVED' ? 'bg-red-950/50 text-red-400 border-red-800/40' :
                          'bg-amber-950/50 text-amber-400 border-amber-800/40'
                        }`}>
                          {product.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock & Publishing Row */}
                  <div className="flex items-center justify-between p-2 bg-[#161616] rounded-xs border border-[#222] text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${
                        stockSummary.overallStatus === 'IN STOCK' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' :
                        stockSummary.overallStatus === 'LOW STOCK' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' :
                        'bg-red-950/40 text-red-400 border border-red-800/40'
                      }`}>
                        {stockSummary.overallStatus} ({totalUnits})
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleTogglePublish(product.id, e)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold ${
                        product.published 
                          ? 'bg-blue-950/50 text-blue-300 border border-blue-700/50' 
                          : 'bg-[#181818] text-[#777] border border-[#2B2B2B]'
                      }`}
                    >
                      {product.published ? (
                        <>
                          <Globe className="w-3 h-3 text-blue-300" />
                          PUBLISHED
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3 text-[#666]" />
                          HIDDEN
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mobile Actions Grid (Touch targets min 44px) */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#1C1C1C]">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="min-h-[44px] px-2 py-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] rounded text-center text-xs font-mono uppercase text-white flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#888]" />
                      <span>Overview</span>
                    </Link>

                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="min-h-[44px] px-2 py-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] hover:border-[#D4AF37] rounded text-center text-xs font-mono uppercase text-[#D4AF37] flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleToggleArchive(product.id, e)}
                      className="min-h-[44px] px-2 py-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] rounded text-center text-xs font-mono uppercase text-[#AAA] flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Archive className="w-3.5 h-3.5 text-[#888]" />
                      <span>{product.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</span>
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
                <th className="px-5 py-3.5 font-bold w-14">Image</th>
                <th className="px-5 py-3.5 font-bold">Product & Identification</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Category & Drop</th>
                <th className="px-5 py-3.5 font-bold text-right">Price (ZAR)</th>
                <th className="px-5 py-3.5 font-bold text-right">Cost / Margin</th>
                <th className="px-5 py-3.5 font-bold text-center">Storefront</th>
                <th className="px-5 py-3.5 font-bold">Stock</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-xs text-[#888] font-mono">
                    LOADING PRODUCTS CATALOGUE...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center bg-red-950/20">
                    <div className="max-w-md mx-auto space-y-3 text-red-400 font-mono">
                      <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-red-300">Unable to load products</h3>
                      <p className="text-xs text-[#888] font-mono">
                        {error}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#777]">
                        <Boxes className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">NO PRODUCTS YET</h3>
                      <p className="text-xs text-[#888] font-mono">
                        Create your first VERITAS product to begin managing your catalogue.
                      </p>
                      <div className="pt-2">
                        <Link 
                          href="/admin/products/new"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors shadow-lg shadow-[#D4AF37]/10"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Product
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-xs text-[#666] font-mono">
                    NO PRODUCTS MATCH CURRENT SEARCH OR FILTER CRITERIA
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const profit = calculateProfitMetrics(product.price, product.costPrice);
                  const stockSummary = calculateProductTotalStock(product.variants || []);
                  const totalUnits = stockSummary.totalQuantity;
                  const primaryImg = product.images?.find(img => img.isPrimary)?.url || product.image;

                  return (
                    <tr 
                      key={product.id} 
                      onClick={() => router.push(`/admin/products/${product.id}`)}
                      className={`hover:bg-[#161616] cursor-pointer transition-colors ${
                        product.status === 'ARCHIVED' ? 'opacity-60 bg-[#0c0c0c]' : ''
                      }`}
                    >
                      {/* Image */}
                      <td className="px-5 py-3.5">
                        <div className="w-11 h-14 bg-[#1A1A1A] border border-[#262626] overflow-hidden relative rounded-sm flex items-center justify-center">
                          {primaryImg ? (
                            <img 
                              src={primaryImg} 
                              alt={product.name} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-[#141414] text-[#555] p-1">
                              <ImageIcon className="w-4 h-4 text-[#444]" />
                              <span className="text-[7px] font-mono mt-0.5 text-[#555] uppercase tracking-tighter">NO IMG</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Product Name & SKU */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white tracking-wide hover:text-[#D4AF37] transition-colors">
                            {product.name}
                          </span>
                          {product.featured && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 rounded">
                              FEATURED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#777] font-mono mt-0.5">
                          SKU: <span className="text-[#AAA]">{product.sku}</span> • /{product.slug}
                        </div>
                        <div className="text-[10px] text-[#555] font-mono mt-0.5">
                          {product.variants?.length || product.sizes?.length || 0} Variants • {product.colours?.length || 1} Colours
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${
                          product.status === 'ACTIVE' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40' :
                          product.status === 'ARCHIVED' ? 'bg-red-950/50 text-red-400 border-red-800/40' :
                          'bg-amber-950/50 text-amber-400 border-amber-800/40'
                        }`}>
                          {product.status}
                        </span>
                      </td>

                      {/* Category & Collection */}
                      <td className="px-5 py-3.5">
                        <div className="text-xs text-white font-medium font-mono">{product.category}</div>
                        <div className="text-[10px] text-[#777] font-mono mt-0.5">{product.collection || product.drop || 'Core'}</div>
                      </td>

                      {/* Selling Price */}
                      <td className="px-5 py-3.5 font-mono text-right">
                        <div className="font-bold text-white text-xs">{formatZAR(product.price)}</div>
                        {product.compareAtPrice && (
                          <div className="text-[10px] text-[#555] line-through">{formatZAR(product.compareAtPrice)}</div>
                        )}
                      </td>

                      {/* Cost / Margin */}
                      <td className="px-5 py-3.5 font-mono text-right">
                        {product.costPrice ? (
                          <div>
                            <span className="text-xs text-emerald-400 font-bold">
                              {profit.profitMarginPercent}%
                            </span>
                            <span className="text-[10px] text-[#666] block">
                              Cost: {formatZAR(product.costPrice)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#555]">—</span>
                        )}
                      </td>

                      {/* Storefront Publishing Status */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={(e) => handleTogglePublish(product.id, e)}
                          title={product.published ? 'Click to hide from store' : 'Click to publish to store'}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                            product.published 
                              ? 'bg-blue-950/50 text-blue-300 border border-blue-700/50 hover:bg-blue-900/60' 
                              : 'bg-[#181818] text-[#777] border border-[#2B2B2B] hover:border-[#444] hover:text-white'
                          }`}
                        >
                          {product.published ? (
                            <>
                              <Globe className="w-2.5 h-2.5 text-blue-300" />
                              PUBLISHED
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-2.5 h-2.5 text-[#666]" />
                              HIDDEN
                            </>
                          )}
                        </button>
                      </td>

                      {/* Stock Status & Quantity */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${
                            stockSummary.overallStatus === 'IN STOCK' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' :
                            stockSummary.overallStatus === 'LOW STOCK' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' :
                            'bg-red-950/40 text-red-400 border border-red-800/40'
                          }`}>
                            {stockSummary.overallStatus}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-white">
                            ({totalUnits})
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* View Audit Overview */}
                          <Link 
                            href={`/admin/products/${product.id}`}
                            className="p-1.5 text-[#888] hover:text-white hover:bg-[#222] rounded transition-colors" 
                            title="View Product Audit Overview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {/* Edit Product */}
                          <Link 
                            href={`/admin/products/${product.id}/edit`}
                            className="p-1.5 text-[#888] hover:text-[#D4AF37] hover:bg-[#222] rounded transition-colors" 
                            title="Edit Product"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>

                          {/* Duplicate */}
                          <button
                            onClick={(e) => handleDuplicate(product.id, e)}
                            className="p-1.5 text-[#888] hover:text-white hover:bg-[#222] rounded transition-colors"
                            title="Duplicate Product"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Archive / Restore button */}
                          <button 
                            onClick={(e) => handleToggleArchive(product.id, e)}
                            className="p-1.5 text-[#888] hover:text-amber-400 hover:bg-[#222] rounded transition-colors" 
                            title={product.status === 'ARCHIVED' ? "Restore Product" : "Archive Product"}
                          >
                            {product.status === 'ARCHIVED' ? <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>

                          {/* Delete */}
                          <button 
                            onClick={(e) => handleDelete(product.id, e)}
                            className="p-1.5 text-[#666] hover:text-red-400 hover:bg-red-950/30 rounded transition-colors" 
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER STATS */}
        <div className="p-4 border-t border-[#1F1F1F] flex flex-col sm:flex-row justify-between items-center bg-[#151515] text-xs font-mono text-[#888] gap-2">
          <span>
            Showing {filteredProducts.length} of {products.length} products • {products.filter(p => p.published).length} Published to Storefront
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#D4AF37] font-bold">
              CENTRAL VERITAS PRODUCT REPOSITORY ACTIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  </AdminAccessGuard>
  );
}
