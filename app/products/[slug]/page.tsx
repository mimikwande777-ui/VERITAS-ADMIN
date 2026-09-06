'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Check, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Layers, 
  Ruler, 
  ChevronRight, 
  ChevronDown,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  ImageIcon
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { useProductsStore, calculateProductTotalStock, isProductPubliclyVisible } from '@/lib/product-store';
import { addToCart } from '@/lib/cart-store';
import { formatZAR } from '@/lib/utils';
import { ProductItem } from '@/lib/mock-data';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || '';
  const products = useProductsStore();

  // Find product by slug or id
  const product = useMemo(() => {
    return products.find(p => p.slug === slug || p.id === slug) || null;
  }, [products, slug]);

  // Selected state
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // Accordion sections
  const [openSection, setOpenSection] = useState<'details' | 'sizing' | 'shipping' | null>('details');

  // Initialize selected color & size when product loads
  useEffect(() => {
    if (product) {
      queueMicrotask(() => {
        if (product.colours && product.colours.length > 0 && !selectedColor) {
          const c0 = product.colours[0];
          setSelectedColor(typeof c0 === 'string' ? c0 : (c0 as any)?.name || '');
        }
        if (product.sizes && product.sizes.length > 0 && !selectedSize) {
          // pick first in-stock size if available
          const firstInStockVariant = product.variants?.find(v => v.stockQuantity > 0);
          setSelectedSize(firstInStockVariant ? firstInStockVariant.size : product.sizes[0]);
        }
      });
    }
  }, [product, selectedColor, selectedSize]);

  // Extract media images
  const allImages = useMemo(() => {
    if (!product) return [];
    if (product.images && product.images.length > 0) {
      return product.images.map(img => img.url);
    }
    if (product.image) {
      return [product.image];
    }
    return [];
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        <StoreHeader />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">Product Not Found</h2>
          <p className="text-xs text-[#888] font-mono mb-6">The requested garment could not be found or has been archived.</p>
          <Link
            href="/shop"
            className="px-6 py-3 bg-[#D4AF37] text-black font-bold uppercase text-xs tracking-widest hover:bg-[#B3932F] transition-colors"
          >
            Back to Catalogue
          </Link>
        </main>
        <StoreFooter />
      </div>
    );
  }

  // Guard: Product must be ACTIVE, published=true, and associated collection must be active
  if (!isProductPubliclyVisible(product)) {
    const isCollectionInactive = product.collectionIsActive === false;
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
        <StoreHeader />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-[#161616] border border-[#262626] rounded-full flex items-center justify-center mb-6 text-[#D4AF37]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold block mb-2">
            CATALOGUE NOTICE
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-3">
            {isCollectionInactive ? 'Collection Currently Inactive' : 'Garment Currently Unavailable'}
          </h1>
          <p className="text-xs sm:text-sm text-[#888] font-mono leading-relaxed mb-8 max-w-md">
            {isCollectionInactive
              ? `This piece is part of the "${product.collection || 'Collection'}" collection, which is currently inactive and not available for purchase.`
              : 'This garment is currently unlisted, in draft status, or archived from public release.'}
          </p>
          <Link
            href="/shop"
            className="px-8 py-3.5 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-widest hover:bg-[#B3932F] transition-colors"
          >
            Browse Available Garments
          </Link>
        </main>
        <StoreFooter />
      </div>
    );
  }

  // Current variant lookup
  const currentVariant = product.variants?.find(
    v => (((v as any).colour || (v as any).color) === selectedColor || !selectedColor) && v.size === selectedSize
  );

  const stockSummary = calculateProductTotalStock(product.variants || []);
  const variantStock = currentVariant !== undefined ? currentVariant.stockQuantity : stockSummary.totalQuantity;
  const isVariantOutOfStock = variantStock <= 0;
  const isVariantLowStock = variantStock > 0 && variantStock <= 5;

  // Handle Add to Bag
  const handleAddToBag = () => {
    if (isVariantOutOfStock || isAdding) return;

    if (!selectedSize && product.sizes && product.sizes.length > 0) {
      alert('Please select a size');
      return;
    }

    setIsAdding(true);

    const primaryImg = allImages[activeImageIndex] || allImages[0] || '';

    const res = addToCart({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      quantity,
      color: selectedColor || 'Standard',
      size: selectedSize || 'One Size',
      image: primaryImg,
      sku: currentVariant?.sku || product.sku,
      maxStock: variantStock
    });

    setTimeout(() => {
      setIsAdding(false);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 2500);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-mono text-[#777] mb-6 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-white transition-colors">HOME</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-white transition-colors">SHOP</Link>
          <span>/</span>
          <span className="text-[#D4AF37] uppercase font-bold truncate">{product.name}</span>
        </div>

        {/* 2-COLUMN MAIN PRODUCT VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* LEFT: IMAGE GALLERY (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Primary Large Image Stage */}
            <div className="relative aspect-4/5 sm:aspect-3/4 w-full bg-[#121212] border border-[#1F1F1F] rounded-xs overflow-hidden flex items-center justify-center">
              {allImages.length > 0 ? (
                <img
                  src={allImages[activeImageIndex] || allImages[0]}
                  alt={`${product.name} - View ${activeImageIndex + 1}`}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-[#555] p-8">
                  <ImageIcon className="w-12 h-12 text-[#333] mb-2" />
                  <span className="text-xs font-mono uppercase tracking-widest">NO IMAGE REGISTERED</span>
                </div>
              )}

              {/* Status Tags */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.drop && (
                  <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-black/80 text-[#D4AF37] border border-[#D4AF37]/30 uppercase tracking-widest backdrop-blur-xs">
                    {product.drop}
                  </span>
                )}
                {product.featured && (
                  <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-[#D4AF37] text-black uppercase tracking-widest">
                    FEATURED
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail Strip (Touch / Clickable) */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {allImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-16 h-20 sm:w-20 sm:h-24 bg-[#141414] border rounded-xs overflow-hidden shrink-0 transition-all ${
                      activeImageIndex === idx
                        ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]'
                        : 'border-[#222] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: BUY BOX & PRODUCT DETAILS (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Header & Price in ZAR */}
            <div className="border-b border-[#1F1F1F] pb-5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#888] uppercase tracking-widest">
                <span>{product.category || 'Core Collection'}</span>
                <span>SKU: {currentVariant?.sku || product.sku}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold uppercase tracking-tight text-white">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-2xl font-light text-white font-mono">
                  {formatZAR(product.price)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <span className="text-sm font-mono text-[#666] line-through">
                    {formatZAR(product.compareAtPrice)}
                  </span>
                )}
                <span className="text-[10px] font-mono text-[#888] uppercase">
                  VAT INCLUDED • DISPATCH FROM SA
                </span>
              </div>
            </div>

            {/* COLOUR SELECTION */}
            {product.colours && product.colours.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider">
                  <span className="text-[#888]">Colour:</span>
                  <span className="text-white font-bold">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colours.map((col) => {
                    const colName = typeof col === 'string' ? col : (col as any)?.name || '';
                    return (
                      <button
                        key={colName}
                        onClick={() => setSelectedColor(colName)}
                        className={`min-h-[44px] px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-xs border transition-all ${
                          selectedColor === colName
                            ? 'bg-white text-black font-bold border-white ring-1 ring-white'
                            : 'bg-[#141414] text-[#CCC] border-[#2B2B2B] hover:border-[#555]'
                        }`}
                      >
                        {colName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SIZE SELECTION */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider">
                  <span className="text-[#888]">Select Size:</span>
                  <button
                    onClick={() => setSizeGuideOpen(!sizeGuideOpen)}
                    className="text-[#D4AF37] hover:underline flex items-center gap-1 lowercase text-[11px]"
                  >
                    <Ruler className="w-3 h-3" />
                    <span>size guide</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {product.sizes.map((size) => {
                    const variantForSize = product.variants?.find(
                      v => (((v as any).colour || (v as any).color) === selectedColor || !selectedColor) && v.size === size
                    );
                    const sizeStock = variantForSize ? variantForSize.stockQuantity : 10;
                    const isSizeSoldOut = sizeStock <= 0;
                    const isSelected = selectedSize === size;

                    return (
                      <button
                        key={size}
                        onClick={() => !isSizeSoldOut && setSelectedSize(size)}
                        disabled={isSizeSoldOut}
                        className={`min-h-[44px] py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xs border transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg'
                            : isSizeSoldOut
                            ? 'bg-[#101010] text-[#444] border-[#1C1C1C] line-through cursor-not-allowed'
                            : 'bg-[#141414] text-white border-[#2A2A2A] hover:border-[#555]'
                        }`}
                      >
                        <span>{size}</span>
                        {isSizeSoldOut ? (
                          <span className="text-[8px] text-[#555] lowercase">sold out</span>
                        ) : sizeStock <= 3 ? (
                          <span className="text-[8px] text-amber-400 font-bold">{sizeStock} left</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STOCK & OTC TELEMETRY STATUS */}
            <div className="p-3 bg-[#121212] border border-[#222] rounded-xs flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  isVariantOutOfStock ? 'bg-red-500' : isVariantLowStock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                }`} />
                <span className="text-white font-bold">
                  {isVariantOutOfStock 
                    ? 'CURRENTLY SOLD OUT' 
                    : isVariantLowStock 
                    ? `LOW STOCK (${variantStock} REMAINING)` 
                    : 'IN STOCK & READY FOR OTC DISPATCH'}
                </span>
              </div>
              <span className="text-[10px] text-[#777] uppercase">OTC LIVE QUEUE</span>
            </div>

            {/* QUANTITY + ADD TO BAG ACTIONS */}
            <div className="space-y-3 pt-2">
              <div className="flex gap-3">
                {/* Quantity Stepper (touch target min 44px) */}
                <div className="flex items-center bg-[#141414] border border-[#2A2A2A] rounded-xs">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || isVariantOutOfStock}
                    aria-label="Decrease quantity"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#AAA] hover:text-white disabled:text-[#444] transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[36px] text-center font-mono text-sm font-bold text-white">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(variantStock || 99, quantity + 1))}
                    disabled={quantity >= variantStock || isVariantOutOfStock}
                    aria-label="Increase quantity"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#AAA] hover:text-white disabled:text-[#444] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Primary Add to Bag Button (Touch target min 48px) */}
                <button
                  onClick={handleAddToBag}
                  disabled={isVariantOutOfStock || isAdding}
                  className={`flex-1 min-h-[48px] px-6 text-xs font-bold uppercase tracking-[0.2em] rounded-xs transition-all flex items-center justify-center gap-2 ${
                    addedSuccess
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : isVariantOutOfStock
                      ? 'bg-[#1F1F1F] text-[#666] cursor-not-allowed border border-[#2B2B2B]'
                      : 'bg-[#D4AF37] hover:bg-[#B3932F] text-black active:scale-[0.99] shadow-lg'
                  }`}
                >
                  {isAdding ? (
                    <span>Adding to Bag...</span>
                  ) : addedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added to Bag</span>
                    </>
                  ) : isVariantOutOfStock ? (
                    <span>Sold Out</span>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Bag • {formatZAR(product.price * quantity)}</span>
                    </>
                  )}
                </button>
              </div>

              {addedSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-mono rounded-xs flex items-center justify-between animate-in fade-in">
                  <span>Item added to your shopping bag!</span>
                  <Link href="/cart" className="underline font-bold hover:text-white">
                    View Bag & Checkout →
                  </Link>
                </div>
              )}
            </div>

            {/* SIZE GUIDE MODAL/CARD */}
            {sizeGuideOpen && (
              <div className="p-4 bg-[#121212] border border-[#2B2B2B] rounded-xs space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Size Chart (Centimetres)</h4>
                  <button 
                    onClick={() => setSizeGuideOpen(false)}
                    className="text-xs text-[#888] hover:text-white font-mono"
                  >
                    Close
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono text-[#AAA]">
                    <thead className="bg-[#181818] text-white">
                      <tr>
                        <th className="p-2">Size</th>
                        <th className="p-2">Chest Width</th>
                        <th className="p-2">Body Length</th>
                        <th className="p-2">Sleeve</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      <tr><td className="p-2 font-bold text-white">S</td><td className="p-2">56 cm</td><td className="p-2">70 cm</td><td className="p-2">61 cm</td></tr>
                      <tr><td className="p-2 font-bold text-white">M</td><td className="p-2">59 cm</td><td className="p-2">72 cm</td><td className="p-2">63 cm</td></tr>
                      <tr><td className="p-2 font-bold text-white">L</td><td className="p-2">62 cm</td><td className="p-2">74 cm</td><td className="p-2">65 cm</td></tr>
                      <tr><td className="p-2 font-bold text-white">XL</td><td className="p-2">65 cm</td><td className="p-2">76 cm</td><td className="p-2">67 cm</td></tr>
                      <tr><td className="p-2 font-bold text-white">XXL</td><td className="p-2">68 cm</td><td className="p-2">78 cm</td><td className="p-2">69 cm</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-[#666] font-mono">
                  * All silhouettes feature an oversized boxy streetwear drape. We recommend taking your normal size.
                </p>
              </div>
            )}

            {/* ACCORDION TABS: DETAILS, FABRIC, SHIPPING */}
            <div className="border-t border-[#1F1F1F] pt-4 space-y-2 font-mono text-xs">
              {/* Product Description */}
              <div className="border border-[#1F1F1F] rounded-xs bg-[#0E0E0E] overflow-hidden">
                <button
                  onClick={() => setOpenSection(openSection === 'details' ? null : 'details')}
                  className="w-full p-4 flex items-center justify-between text-left font-bold uppercase tracking-wider text-white hover:bg-[#141414] transition-colors"
                >
                  <span>Description & Silhouette</span>
                  <ChevronDown className={`w-4 h-4 text-[#888] transition-transform ${openSection === 'details' ? 'rotate-180' : ''}`} />
                </button>
                {openSection === 'details' && (
                  <div className="p-4 pt-0 text-[#888] leading-relaxed font-sans text-xs border-t border-[#191919] mt-2">
                    <p>{product.description || 'Premium heavyweight garment crafted with meticulous attention to tailoring, stitch density, and custom-dyed finishes.'}</p>
                    <ul className="mt-3 space-y-1 font-mono text-[11px] text-[#AAA] list-disc list-inside">
                      <li>Drop-shoulder architectural cut</li>
                      <li>Double-needle construction across seams</li>
                      <li>High-tensile ribbing at neck and cuffs</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Garment Details & Fabric */}
              <div className="border border-[#1F1F1F] rounded-xs bg-[#0E0E0E] overflow-hidden">
                <button
                  onClick={() => setOpenSection(openSection === 'sizing' ? null : 'sizing')}
                  className="w-full p-4 flex items-center justify-between text-left font-bold uppercase tracking-wider text-white hover:bg-[#141414] transition-colors"
                >
                  <span>Textile Specifications</span>
                  <ChevronDown className={`w-4 h-4 text-[#888] transition-transform ${openSection === 'sizing' ? 'rotate-180' : ''}`} />
                </button>
                {openSection === 'sizing' && (
                  <div className="p-4 pt-0 text-[#888] space-y-2 border-t border-[#191919] mt-2 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-[#181818]">
                      <span>Weight:</span>
                      <strong className="text-white">450 GSM Heavy French Terry</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#181818]">
                      <span>Composition:</span>
                      <strong className="text-white">100% Combed Ring-Spun Cotton</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#181818]">
                      <span>Dye Process:</span>
                      <strong className="text-white">Reactive Pigment Garment Dye</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Care:</span>
                      <strong className="text-white">Cold wash inside out • Lay flat to dry</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping & Returns */}
              <div className="border border-[#1F1F1F] rounded-xs bg-[#0E0E0E] overflow-hidden">
                <button
                  onClick={() => setOpenSection(openSection === 'shipping' ? null : 'shipping')}
                  className="w-full p-4 flex items-center justify-between text-left font-bold uppercase tracking-wider text-white hover:bg-[#141414] transition-colors"
                >
                  <span>Courier & Returns (South Africa)</span>
                  <ChevronDown className={`w-4 h-4 text-[#888] transition-transform ${openSection === 'shipping' ? 'rotate-180' : ''}`} />
                </button>
                {openSection === 'shipping' && (
                  <div className="p-4 pt-0 text-[#888] space-y-2 border-t border-[#191919] mt-2 text-[11px] font-sans">
                    <p>
                      <strong>Nationwide Door-to-Door Courier:</strong> Dispatched via reliable express couriers across all South African provinces within 3-5 business days. Free shipping on orders over R1,500.
                    </p>
                    <p>
                      <strong>14-Day Exchanges:</strong> If sizing isn’t perfect, exchange unworn items with all original VERITAS tags attached within 14 days of receipt.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}
