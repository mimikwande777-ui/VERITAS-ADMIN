'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Copy,
  Trash2,
  Eye,
  Boxes,
  Palette,
  Ruler,
  Tag,
  Printer,
  Shield,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Archive,
  Check
} from 'lucide-react';
import { 
  ProductItem, 
  ProductStatus, 
  mockProducts 
} from '@/lib/mock-data';
import { 
  getStoredProducts, 
  persistProducts, 
  fetchProductById,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  calculateProfitMetrics, 
  calculateProductTotalStock, 
  generateSlug, 
  generateVariantSku,
  generateDeterministicId
} from '@/lib/product-store';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { fetchSupabaseProductById, updateSupabaseProduct, deleteSupabaseProduct } from '@/lib/supabase/products';
import { formatZAR } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = (params?.id as string) || '';

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Colour Modal State
  const [isAddColourOpen, setIsAddColourOpen] = useState(false);
  const [editingColourName, setEditingColourName] = useState<string | null>(null);
  const [colourFormName, setColourFormName] = useState('');
  const [colourFormSlug, setColourFormSlug] = useState('');
  const [colourFormHex, setColourFormHex] = useState('#000000');
  const [isSavingColour, setIsSavingColour] = useState(false);

  useEffect(() => {
    if (productId === 'new') {
      router.replace('/admin/products/new');
      return;
    }

    let isMounted = true;

    const syncProduct = async () => {
      setLoading(true);
      console.log('[Product Detail Page] Loading product for ID:', productId);
      const found = await fetchProductById(productId);
      if (isMounted) {
        console.log('[Product Detail Page] Loaded product:', found ? found.name : 'null');
        setProduct(found);
        setLoading(false);
      }
    };

    syncProduct();

    window.addEventListener('veritas_products_updated', syncProduct);
    return () => {
      isMounted = false;
      window.removeEventListener('veritas_products_updated', syncProduct);
    };
  }, [productId, router]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (loading) {
    return (
      <div className="bg-[#111] border border-[#222] p-12 text-center max-w-lg mx-auto mt-12 space-y-4">
        <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
        <p className="text-xs font-mono uppercase text-[#888] tracking-wider">
          Retrieving product from Supabase...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-[#111] border border-[#222] p-12 text-center max-w-lg mx-auto mt-12">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h2 className="text-base font-bold uppercase text-white font-mono mb-2">
          Product Not Found
        </h2>
        <p className="text-xs text-[#888] font-mono mb-6">
          No product was found matching ID or slug &quot;{productId}&quot;.
        </p>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold font-mono uppercase tracking-wider hover:bg-[#B3932F] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Products Catalog
        </Link>
      </div>
    );
  }

  const profitMetrics = calculateProfitMetrics(product.price, product.costPrice);
  const displayProfitPerUnit = product.profitPerUnit !== undefined ? product.profitPerUnit : profitMetrics.profitPerUnit;
  const displayProfitMargin = product.profitMargin !== undefined ? Number(product.profitMargin).toFixed(1) : profitMetrics.profitMarginPercent;
  const totalStockSummary = calculateProductTotalStock(product.variants || []);
  const allImages = product.images && product.images.length > 0 
    ? product.images 
    : [
        { id: '1', url: product.image, role: 'main' as const, isPrimary: true, alt: product.name },
        ...(product.galleryImages || []).map((url, i) => ({ id: `gal-${i}`, url, role: 'gallery' as const, isPrimary: false, alt: `${product.name} ${i}` }))
      ];

  const currentHeroImage = allImages[activeImageIndex]?.url || product.image;

  // Handle Quick Status Change
  const handleStatusChange = async (newStatus: ProductStatus) => {
    if (isSupabaseConfigured()) {
      const { product: updated } = await updateSupabaseProduct(product.id, {
        status: newStatus,
        published: newStatus === 'ACTIVE' ? product.published : false,
      });
      if (updated) {
        setProduct(updated);
        showToast(`Product status updated to ${newStatus}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
      } else {
        showToast('Failed to update status in Supabase');
      }
      return;
    }

    const products = getStoredProducts(mockProducts);
    const updated = products.map(p => {
      if (p.id === product.id) {
        return {
          ...p,
          status: newStatus,
          active: newStatus === 'ACTIVE',
          published: newStatus === 'ACTIVE' ? p.published : false,
          updatedAt: new Date().toISOString().split('T')[0]
        };
      }
      return p;
    });

    persistProducts(updated);
    setProduct(updated.find(p => p.id === product.id) || null);
    showToast(`Product status updated to ${newStatus}`);
  };

  // Handle Quick Publish Toggle
  const handleTogglePublish = async () => {
    const newPublished = !product.published;
    const newStatus = newPublished && product.status !== 'ACTIVE' ? 'ACTIVE' : product.status;

    if (isSupabaseConfigured()) {
      const { product: updated } = await updateSupabaseProduct(product.id, {
        published: newPublished,
        status: newStatus,
      });
      if (updated) {
        setProduct(updated);
        showToast(newPublished ? 'Product published to store' : 'Product removed from public store');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
      } else {
        showToast('Failed to toggle publish in Supabase');
      }
      return;
    }

    const products = getStoredProducts(mockProducts);
    const updated = products.map(p => {
      if (p.id === product.id) {
        return {
          ...p,
          published: newPublished,
          status: newStatus,
          active: newStatus === 'ACTIVE',
          updatedAt: new Date().toISOString().split('T')[0]
        };
      }
      return p;
    });

    persistProducts(updated);
    setProduct(updated.find(p => p.id === product.id) || null);
    showToast(newPublished ? 'Product published to store' : 'Product removed from public store');
  };

  // Handle Duplicate Product
  const handleDuplicate = () => {
    const products = getStoredProducts(mockProducts);
    const newId = generateDeterministicId('PRD');
    const duplicateProduct: ProductItem = {
      ...product,
      id: newId,
      name: `${product.name} (Copy)`,
      slug: `${product.slug}-copy-${generateDeterministicId('cpy')}`,
      sku: `${product.sku}-CPY`,
      status: 'DRAFT',
      published: false,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      variants: (product.variants || []).map(v => ({
        ...v,
        id: generateDeterministicId('var'),
        sku: `${v.sku}-CPY`
      }))
    };

    persistProducts([duplicateProduct, ...products]);
    showToast(`Created duplicate "${duplicateProduct.name}"`);
    router.push(`/admin/products/${duplicateProduct.id}`);
  };

  // Handle Delete Product
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete "${product.name}"? This action cannot be undone.`)) {
      return;
    }

    if (isSupabaseConfigured()) {
      const success = await deleteSupabaseProduct(product.id);
      if (success) {
        showToast(`Deleted product "${product.name}" from Supabase`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
        router.push('/admin/products');
      } else {
        showToast(`Delete failed for product from Supabase`);
      }
      return;
    }

    const products = getStoredProducts(mockProducts);
    const updated = products.filter(p => p.id !== product.id);
    persistProducts(updated);
    showToast(`Deleted product "${product.name}"`);
    router.push('/admin/products');
  };

  // Colour Modal Handlers
  const handleOpenAddColour = () => {
    setEditingColourName(null);
    setColourFormName('');
    setColourFormSlug('');
    setColourFormHex('#000000');
    setIsAddColourOpen(true);
  };

  const handleOpenEditColour = (col: { name: string; code?: string }) => {
    setEditingColourName(col.name);
    setColourFormName(col.name);
    setColourFormSlug(col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    setColourFormHex(col.code || '#000000');
    setIsAddColourOpen(true);
  };

  const handleSaveColourModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colourFormName.trim()) {
      showToast('Colour name cannot be empty');
      return;
    }

    setIsSavingColour(true);
    const existingColours = product.colours || [];
    let updatedColours = [...existingColours];
    let updatedVariants = [...(product.variants || [])];
    let updatedImages = [...(product.images || [])];

    if (editingColourName) {
      // Renaming / Updating
      updatedColours = updatedColours.map(c => 
        c.name === editingColourName 
          ? { ...c, name: colourFormName.trim(), code: colourFormHex } 
          : c
      );
      // Update variant references
      updatedVariants = updatedVariants.map(v => 
        v.colour === editingColourName 
          ? { ...v, colour: colourFormName.trim() } 
          : v
      );
      // Update image colourName
      updatedImages = updatedImages.map(img => 
        img.colourName === editingColourName 
          ? { ...img, colourName: colourFormName.trim() } 
          : img
      );
    } else {
      // Adding new colour
      if (existingColours.some(c => c.name.toLowerCase() === colourFormName.trim().toLowerCase())) {
        showToast('A colour with this name already exists.');
        setIsSavingColour(false);
        return;
      }
      updatedColours.push({
        id: generateDeterministicId('col'),
        name: colourFormName.trim(),
        code: colourFormHex
      });
      // Generate default size variants for this colour (e.g. S, M, L, XL)
      const defaultSizes = ['S', 'M', 'L', 'XL'];
      defaultSizes.forEach(size => {
        updatedVariants.push({
          id: generateDeterministicId('var'),
          sku: generateVariantSku(product.slug, colourFormName.trim(), size),
          colour: colourFormName.trim(),
          size: size,
          stockQuantity: 10,
          lowStockThreshold: 5,
          status: 'IN STOCK'
        });
      });
    }

    if (isSupabaseConfigured()) {
      const { product: updated, error } = await updateSupabaseProduct(product.id, {
        colours: updatedColours,
        variants: updatedVariants,
        images: updatedImages,
      });

      if (updated) {
        setProduct(updated);
        showToast(editingColourName ? `Colour "${colourFormName}" updated` : `Colour "${colourFormName}" added with default sizes`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
        setIsAddColourOpen(false);
      } else {
        showToast(error || 'Failed to update colours in Supabase');
      }
    } else {
      const products = getStoredProducts(mockProducts);
      const updatedProduct: ProductItem = {
        ...product,
        colours: updatedColours,
        variants: updatedVariants,
        images: updatedImages,
        updatedAt: new Date().toISOString().split('T')[0]
      };
      const updatedList = products.map(p => p.id === product.id ? updatedProduct : p);
      persistProducts(updatedList);
      setProduct(updatedProduct);
      showToast(editingColourName ? `Colour "${colourFormName}" updated` : `Colour "${colourFormName}" added`);
      setIsAddColourOpen(false);
    }
    setIsSavingColour(false);
  };

  const handleRemoveColour = async (colourName: string) => {
    if (!confirm(`Are you sure you want to remove the colour "${colourName}" and all associated variants & media?`)) {
      return;
    }

    const updatedColours = (product.colours || []).filter(c => c.name !== colourName);
    const updatedVariants = (product.variants || []).filter(v => v.colour !== colourName);
    const updatedImages = (product.images || []).filter(img => img.colourName !== colourName);

    if (isSupabaseConfigured()) {
      const { product: updated, error } = await updateSupabaseProduct(product.id, {
        colours: updatedColours,
        variants: updatedVariants,
        images: updatedImages,
      });

      if (updated) {
        setProduct(updated);
        showToast(`Colour "${colourName}" removed`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_products_updated'));
        }
      } else {
        showToast(error || 'Failed to remove colour in Supabase');
      }
    } else {
      const products = getStoredProducts(mockProducts);
      const updatedProduct: ProductItem = {
        ...product,
        colours: updatedColours,
        variants: updatedVariants,
        images: updatedImages,
        updatedAt: new Date().toISOString().split('T')[0]
      };
      const updatedList = products.map(p => p.id === product.id ? updatedProduct : p);
      persistProducts(updatedList);
      setProduct(updatedProduct);
      showToast(`Colour "${colourName}" removed`);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161616] border border-[#D4AF37] text-white px-5 py-3.5 rounded shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
          <span className="text-xs font-mono font-medium">{toastMessage}</span>
        </div>
      )}

      {/* TOP BREADCRUMB & HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/products"
            className="p-2.5 bg-[#111] hover:bg-[#181818] rounded border border-[#262626] transition-colors text-[#BBB]"
            title="Back to Products"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold uppercase tracking-widest text-white">
                {product.name}
              </h1>
              
              {/* Status Badge */}
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded uppercase border ${
                product.status === 'ACTIVE' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' :
                product.status === 'ARCHIVED' ? 'bg-red-950/60 text-red-400 border-red-800/50' :
                'bg-amber-950/60 text-amber-400 border-amber-800/50'
              }`}>
                {product.status}
              </span>

              {/* Published Badge */}
              {product.published ? (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/50 flex items-center gap-1">
                  <Check className="w-3 h-3" /> PUBLISHED
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#888] px-2 py-0.5 rounded bg-[#161616] border border-[#2B2B2B]">
                  HIDDEN FROM STORE
                </span>
              )}

              {product.featured && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40">
                  FEATURED HERO
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#888] mt-1.5">
              <span>ID: <strong className="text-[#CCC]">{product.id}</strong></span>
              <span>•</span>
              <span>SKU: <strong className="text-[#CCC]">{product.sku}</strong></span>
              <span>•</span>
              <span>Slug: <strong className="text-[#CCC]">/products/{product.slug}</strong></span>
              <span>•</span>
              <span>Updated: <strong className="text-[#AAA]">{product.updatedAt}</strong></span>
            </div>
          </div>
        </div>

        {/* TOP ACTIONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Publish Toggle */}
          <button
            type="button"
            onClick={handleTogglePublish}
            className={`px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${
              product.published
                ? 'bg-blue-950/40 text-blue-300 border-blue-800/50 hover:bg-blue-900/40'
                : 'bg-[#151515] text-[#AAA] border-[#333] hover:border-[#555]'
            }`}
          >
            {product.published ? 'Published (Storefront)' : 'Draft (Unpublished)'}
          </button>

          {/* Duplicate */}
          <button
            type="button"
            onClick={handleDuplicate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#161616] hover:bg-[#202020] border border-[#2C2C2C] text-xs font-mono uppercase text-[#CCC] transition-colors"
            title="Duplicate Product"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>

          {/* Edit Product */}
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-[#0A0A0A] text-xs font-bold font-mono uppercase tracking-wider transition-colors shadow-lg shadow-[#D4AF37]/10"
          >
            <Edit className="w-3.5 h-3.5" /> Edit Product
          </Link>

          {/* Delete Product */}
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 bg-[#161616] hover:bg-red-950/40 text-[#666] hover:text-red-400 border border-[#2C2C2C] hover:border-red-800/40 rounded transition-colors"
            title="Delete Product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>


      {/* MAIN TWO-COLUMN VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT 2 COLUMNS */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* PRICING & FINANCIAL REPORT (ZAR) */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Financial Performance & Pricing (ZAR)
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#D4AF37] font-bold bg-[#1C1708] border border-[#D4AF37]/30 px-2 py-0.5 rounded">
                STORE CURRENCY: ZAR (R)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Selling Price */}
              <div className="bg-[#151515] border border-[#262626] p-4">
                <span className="text-[10px] uppercase font-mono text-[#888] block">Selling Price</span>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {formatZAR(product.price)}
                </div>
                {product.compareAtPrice && (
                  <span className="text-xs font-mono text-[#666] line-through block mt-0.5">
                    Original: {formatZAR(product.compareAtPrice)}
                  </span>
                )}
              </div>

              {/* Cost Price */}
              <div className="bg-[#151515] border border-[#262626] p-4 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono text-[#888] block">Cost Price</span>
                  <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/50 border border-amber-800/40 px-1.5 py-0.2 rounded">
                    PRIVATE
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#BBB] mt-1">
                  {product.costPrice ? formatZAR(product.costPrice) : '—'}
                </div>
                <span className="text-[10px] text-amber-500/80 font-mono block mt-0.5">
                  CONFIDENTIAL TO VERITAS ADMIN
                </span>
              </div>

              {/* Profit Per Unit */}
              <div className="bg-[#151515] border border-[#262626] p-4">
                <span className="text-[10px] uppercase font-mono text-[#888] block">Unit Profit</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {formatZAR(displayProfitPerUnit)}
                </div>
                <span className="text-[10px] font-mono text-emerald-400/80 block mt-0.5 font-bold">
                  {displayProfitMargin}% Margin ({profitMetrics.markupPercent}% Markup)
                </span>
              </div>
            </div>

            {/* Profit margin progress bar */}
            <div className="bg-[#151515] border border-[#262626] p-3 rounded">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-[#888]">Cost vs. Profit Breakdown</span>
                <span className="text-white font-bold">{displayProfitMargin}% Margin</span>
              </div>
              <div className="h-2 bg-[#222] rounded-full overflow-hidden flex">
                <div 
                  className="bg-amber-700 h-full" 
                  style={{ width: `${Math.max(0, 100 - Number(displayProfitMargin))}%` }} 
                  title="Cost Portion"
                />
                <div 
                  className="bg-emerald-500 h-full" 
                  style={{ width: `${Math.min(100, Number(displayProfitMargin))}%` }} 
                  title="Profit Portion"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#777] mt-1.5">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-700" /> Cost: {formatZAR(product.costPrice || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Profit: {formatZAR(displayProfitPerUnit)}
                </span>
              </div>
            </div>
          </div>


          {/* ==================================================
              SECTION: DEDICATED PRODUCT COLOURS
              ================================================== */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F1F1F] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Product Colours
                </h2>
                <span className="text-[10px] font-mono text-[#D4AF37] bg-[#1C1708] border border-[#D4AF37]/30 px-2 py-0.5 rounded">
                  {(product.colours || []).length} Available
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenAddColour}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D4AF37] hover:bg-[#B3932F] text-[#0A0A0A] text-xs font-bold font-mono uppercase tracking-wider transition-colors shadow-sm"
              >
                + Add Colour
              </button>
            </div>

            {/* List of Colours */}
            {(product.colours || []).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(product.colours || []).map((col) => {
                  const variantCount = (product.variants || []).filter(v => v.colour === col.name).length;
                  const imageCount = (product.images || []).filter(img => img.colourName === col.name).length;
                  const hexCode = col.code || '#000000';

                  return (
                    <div
                      key={col.name}
                      className="bg-[#151515] border border-[#262626] hover:border-[#383838] p-4 flex flex-col justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full border-2 border-[#333] shadow-inner flex-shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: hexCode }}
                          />
                          <div>
                            <span className="text-sm font-bold text-white uppercase font-mono block">
                              {col.name}
                            </span>
                            <span className="text-[10px] font-mono text-[#888] block">
                              HEX: <strong className="text-[#CCC]">{hexCode}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditColour(col)}
                            className="p-1.5 bg-[#202020] hover:bg-[#D4AF37] hover:text-[#0A0A0A] text-[#AAA] rounded transition-colors text-xs"
                            title="Edit Colour"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveColour(col.name)}
                            className="p-1.5 bg-[#202020] hover:bg-red-950/80 hover:text-red-300 text-[#777] rounded transition-colors text-xs"
                            title="Remove Colour"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#202020] text-[11px] font-mono text-[#777]">
                        <span className="flex items-center gap-1 text-[#AAA]">
                          <Boxes className="w-3 h-3 text-[#D4AF37]" />
                          <strong>{variantCount}</strong> variant{variantCount === 1 ? '' : 's'}
                        </span>
                        <span className="flex items-center gap-1 text-[#AAA]">
                          <ImageIcon className="w-3 h-3 text-[#D4AF37]" />
                          <strong>{imageCount}</strong> image{imageCount === 1 ? '' : 's'}
                        </span>
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="text-[#D4AF37] hover:underline text-[10px] uppercase font-bold"
                        >
                          Manage →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#0D0D0D] border border-dashed border-[#262626] p-4">
                <Palette className="w-6 h-6 text-[#555] mx-auto mb-2" />
                <p className="text-xs font-mono text-[#888] mb-3">No colours assigned to this product.</p>
                <button
                  type="button"
                  onClick={handleOpenAddColour}
                  className="px-3 py-1.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold font-mono uppercase"
                >
                  + Add First Colour
                </button>
              </div>
            )}
          </div>


          {/* VARIANTS & INVENTORY AUDIT */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F1F1F] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Variants & Stock Inventory Matrix
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#888]">Total Stock:</span>
                <span className="font-bold text-white text-sm">{totalStockSummary.totalQuantity} units</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  totalStockSummary.overallStatus === 'IN STOCK' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40' :
                  totalStockSummary.overallStatus === 'LOW STOCK' ? 'bg-amber-950/50 text-amber-400 border border-amber-800/40' :
                  'bg-red-950/50 text-red-400 border border-red-800/40'
                }`}>
                  {totalStockSummary.overallStatus}
                </span>
              </div>
            </div>

            {/* Low stock notice */}
            {totalStockSummary.lowStockVariantCount > 0 && (
              <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded mb-4 flex items-center gap-2.5 text-xs text-amber-300 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  Notice: {totalStockSummary.lowStockVariantCount} variant(s) are below the low stock threshold and need replenishment.
                </span>
              </div>
            )}

            {/* Variant Table */}
            <div className="overflow-x-auto border border-[#222]">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-[#161616] border-b border-[#262626] text-[10px] font-mono uppercase text-[#888]">
                    <th className="py-2.5 px-3">Colour / Size</th>
                    <th className="py-2.5 px-3">SKU Identifier</th>
                    <th className="py-2.5 px-3 text-right">Available Stock</th>
                    <th className="py-2.5 px-3 text-right">Threshold</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C1C1C] text-xs font-mono">
                  {(product.variants || []).map((v) => (
                    <tr key={v.id} className="hover:bg-[#151515] transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-white/20"
                            style={{ backgroundColor: product.colours?.find(c => c.name === v.colour)?.code || '#000' }}
                          />
                          <span className="font-bold text-white">{v.colour}</span>
                          <span className="text-[#555]">/</span>
                          <span className="text-[#D4AF37] font-bold">{v.size}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#AAA]">{v.sku}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">
                        {v.stockQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#777]">
                        {v.lowStockThreshold}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                          v.status === 'IN STOCK' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' :
                          v.status === 'LOW STOCK' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' :
                          'bg-red-950/40 text-red-400 border border-red-800/40'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          {/* VERITAS DESIGN & PRODUCTION SPECIFICATIONS (OTC) */}
          <div className="bg-[#111] border border-amber-900/40 p-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-amber-900/30 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  VERITAS Design & Screenprint Specifications
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded">
                OTC PRODUCTION INFORMATION
              </span>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded mb-5 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/90 font-mono leading-relaxed">
                CONFIDENTIAL: These technical garment specifications are reserved for OTC fulfillment & screenprint manufacturing. They are strictly hidden from the public customer storefront.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-[#0D0D0D] border border-[#222] p-3.5">
                <span className="text-[10px] font-mono uppercase text-[#777] block">Design Identifier</span>
                <span className="text-xs font-mono font-bold text-white mt-1 block">
                  {product.designInfo?.designName || 'VERITAS STANDARD BRANDING'}
                </span>
              </div>
              <div className="bg-[#0D0D0D] border border-[#222] p-3.5">
                <span className="text-[10px] font-mono uppercase text-[#777] block">Print Placement</span>
                <span className="text-xs font-mono font-bold text-[#D4AF37] mt-1 block">
                  {product.designInfo?.printPlacement || 'Full Back'}
                </span>
              </div>
            </div>

            <div className="bg-[#0D0D0D] border border-[#222] p-3.5 mb-4">
              <span className="text-[10px] font-mono uppercase text-[#777] block">Print Dimensions / Scale</span>
              <span className="text-xs font-mono text-[#DDD] mt-1 block">
                {product.designInfo?.printSize || '42cm x 50cm'}
              </span>
            </div>

            <div className="bg-[#0D0D0D] border border-[#222] p-3.5">
              <span className="text-[10px] font-mono uppercase text-[#777] block mb-1">Production & Ink Notes</span>
              <p className="text-xs font-mono text-[#AAA] leading-relaxed whitespace-pre-wrap">
                {product.designInfo?.designNotes || 'Standard screenprint specifications apply.'}
              </p>
            </div>
          </div>


          {/* EDITORIAL STORY & SPECIFICATIONS */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-mono mb-2">
                Editorial Description
              </h3>
              <p className="text-xs text-[#CCC] leading-relaxed font-sans">
                {product.description}
              </p>
            </div>

            {product.specifications && (
              <div className="pt-4 border-t border-[#1F1F1F]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-mono mb-2">
                  Fabric & Construction Specifications
                </h3>
                <pre className="text-xs font-mono text-[#AAA] whitespace-pre-wrap leading-relaxed bg-[#0D0D0D] p-3 border border-[#222]">
                  {product.specifications}
                </pre>
              </div>
            )}
          </div>

        </div>


        {/* RIGHT COLUMN: MEDIA GALLERY & METADATA */}
        <div className="space-y-8">
          
          {/* MEDIA SHOWCASE */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-mono">
                Product Media Assets ({allImages.length})
              </h2>
            </div>

            {/* Main Featured Photo */}
            <div className="aspect-[3/4] bg-[#0A0A0A] border border-[#262626] rounded-sm overflow-hidden mb-3 relative">
              <img
                src={currentHeroImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white text-[9px] font-mono px-2 py-0.5 rounded uppercase border border-white/10">
                {allImages[activeImageIndex]?.role || 'main'}
              </span>
            </div>

            {/* Thumbnail Navigation */}
            <div className="grid grid-cols-4 gap-2">
              {allImages.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`aspect-[3/4] rounded-sm overflow-hidden border transition-all ${
                    activeImageIndex === idx
                      ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]'
                      : 'border-[#262626] opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt={img.alt || product.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>


          {/* ORGANIZATION & CATEGORY METADATA */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 space-y-4">
            <div className="border-b border-[#1F1F1F] pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-mono">
                Catalog Organization
              </h2>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-[#777] block">Category</span>
              <span className="text-xs font-mono font-bold text-white mt-0.5 block">{product.category}</span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-[#777] block">Collection</span>
              <span className="text-xs font-mono font-bold text-white mt-0.5 block">{product.collection}</span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-[#777] block">Drop Release</span>
              <span className="text-xs font-mono font-bold text-[#D4AF37] mt-0.5 block">{product.drop || 'DROP 001'}</span>
            </div>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="pt-3 border-t border-[#1F1F1F]">
                <span className="text-[10px] font-mono uppercase text-[#777] block mb-2">Search Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-[#181818] border border-[#2A2A2A] text-[10px] font-mono text-[#BBB] rounded-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Colours */}
            {product.colours && product.colours.length > 0 && (
              <div className="pt-3 border-t border-[#1F1F1F]">
                <span className="text-[10px] font-mono uppercase text-[#777] block mb-2">Colours Available</span>
                <div className="flex flex-wrap gap-2">
                  {product.colours.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-1.5 px-2 py-1 bg-[#161616] border border-[#282828] rounded-sm text-[11px] font-mono text-white"
                    >
                      <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: col.code }} />
                      <span>{col.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ADD / EDIT COLOUR MODAL */}
      {isAddColourOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#141414] border border-[#333] shadow-2xl w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  {editingColourName ? `Edit Colour: ${editingColourName}` : 'Add New Product Colour'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddColourOpen(false)}
                className="text-[#777] hover:text-white text-lg font-mono leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveColourModal} className="space-y-4">
              {/* Colour Name */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Colour Name <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={colourFormName}
                  onChange={(e) => {
                    setColourFormName(e.target.value);
                    if (!editingColourName) {
                      setColourFormSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }
                  }}
                  placeholder="e.g. Washed Charcoal"
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono"
                />
              </div>

              {/* Colour Slug */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Colour Slug
                </label>
                <input
                  type="text"
                  value={colourFormSlug}
                  onChange={(e) => setColourFormSlug(e.target.value)}
                  placeholder="e.g. washed-charcoal"
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-2.5 text-xs text-[#AAA] focus:outline-none focus:border-[#D4AF37] font-mono"
                />
              </div>

              {/* Hex Code & Swatch */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Colour Swatch & Hex Code
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colourFormHex}
                    onChange={(e) => setColourFormHex(e.target.value)}
                    className="w-10 h-10 p-0.5 bg-[#0A0A0A] border border-[#333] cursor-pointer rounded-none"
                  />
                  <input
                    type="text"
                    value={colourFormHex}
                    onChange={(e) => setColourFormHex(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 bg-[#0A0A0A] border border-[#2B2B2B] p-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                  <div
                    className="w-10 h-10 border border-[#444] rounded flex-shrink-0"
                    style={{ backgroundColor: colourFormHex }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#262626] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddColourOpen(false)}
                  disabled={isSavingColour}
                  className="px-4 py-2 bg-[#1B1B1B] hover:bg-[#252525] text-xs font-mono uppercase text-[#AAA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingColour}
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-[#0A0A0A] text-xs font-bold font-mono uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingColour ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {editingColourName ? 'Update Colour' : 'Add Colour'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
