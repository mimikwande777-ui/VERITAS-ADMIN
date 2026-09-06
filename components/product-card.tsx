'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Eye, Check, ImageIcon } from 'lucide-react';
import { ProductItem } from '@/lib/mock-data';
import { formatZAR } from '@/lib/utils';
import { addToCart } from '@/lib/cart-store';
import { calculateProductTotalStock } from '@/lib/product-store';

interface ProductCardProps {
  product: ProductItem;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const [quickAdded, setQuickAdded] = useState(false);

  // Extract primary image
  const primaryImg = product.images?.find(img => img.isPrimary)?.url || product.image;
  const secondaryImg = product.images?.find(img => !img.isPrimary)?.url;
  const [hovered, setHovered] = useState(false);

  const stockSummary = calculateProductTotalStock(product.variants || []);
  const isOutOfStock = stockSummary.overallStatus === 'OUT OF STOCK' || stockSummary.totalQuantity === 0;
  const isLowStock = stockSummary.overallStatus === 'LOW STOCK';

  // Quick Add handler (adds primary size or first available variant)
  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    const firstVariant = product.variants?.find(v => v.stockQuantity > 0) || product.variants?.[0];
    const chosenSize = firstVariant?.size || product.sizes?.[0] || 'M';
    const chosenColor = (firstVariant as any)?.colour || (firstVariant as any)?.color || (typeof product.colours?.[0] === 'string' ? product.colours[0] : (product.colours?.[0] as any)?.name) || 'Black';
    const maxStock = firstVariant?.stockQuantity ?? stockSummary.totalQuantity;

    addToCart({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      quantity: 1,
      color: chosenColor,
      size: chosenSize,
      image: primaryImg || '',
      sku: firstVariant?.sku || product.sku,
      maxStock
    });

    setQuickAdded(true);
    setTimeout(() => setQuickAdded(false), 2000);
  };

  return (
    <div 
      className="group relative flex flex-col bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#333] transition-all duration-300 rounded-xs overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Product Image Container with 3:4 Aspect Ratio */}
      <Link 
        href={`/products/${product.slug}`} 
        className="relative block w-full aspect-3/4 bg-[#141414] overflow-hidden cursor-pointer"
      >
        {primaryImg && !imageError ? (
          <img
            src={hovered && secondaryImg ? secondaryImg : primaryImg}
            alt={product.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            loading={priority ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#151515] text-[#555] p-4">
            <ImageIcon className="w-8 h-8 text-[#333] mb-2" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">
              {product.name}
            </span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
          {product.drop && (
            <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-black/80 text-[#D4AF37] border border-[#D4AF37]/30 backdrop-blur-xs">
              {product.drop}
            </span>
          )}
          {product.featured && (
            <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-[#D4AF37] text-black">
              FEATURED
            </span>
          )}
        </div>

        {/* Stock Status Badge */}
        <div className="absolute top-2.5 right-2.5 z-10">
          {isOutOfStock ? (
            <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-red-950/80 text-red-400 border border-red-800/60 backdrop-blur-xs">
              SOLD OUT
            </span>
          ) : isLowStock ? (
            <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/60 backdrop-blur-xs">
              LOW STOCK
            </span>
          ) : null}
        </div>

        {/* Quick Add Overlay on Desktop / Quick Tap Bar */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex items-center justify-between gap-2 z-10">
          <button
            onClick={handleQuickAdd}
            disabled={isOutOfStock}
            className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              isOutOfStock
                ? 'bg-[#222] text-[#666] cursor-not-allowed'
                : quickAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-black hover:bg-[#D4AF37]'
            }`}
          >
            {quickAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : isOutOfStock ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Quick Add</span>
              </>
            )}
          </button>
        </div>
      </Link>

      {/* Product Details Section */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-2 bg-[#0D0D0D]">
        <div>
          {/* Category & Colours */}
          <div className="flex items-center justify-between text-[10px] font-mono text-[#777] uppercase tracking-wider mb-1">
            <span>{product.category || 'Streetwear'}</span>
            {product.colours && product.colours.length > 1 && (
              <span>{product.colours.length} Colours</span>
            )}
          </div>

          {/* Title */}
          <Link href={`/products/${product.slug}`} className="block">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-white group-hover:text-[#D4AF37] transition-colors line-clamp-1">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Price in ZAR & Mobile Quick Add */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1A1A1A]">
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-xs sm:text-sm font-bold text-[#E5E5E5]">
              {formatZAR(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-[10px] sm:text-xs text-[#666] line-through">
                {formatZAR(product.compareAtPrice)}
              </span>
            )}
          </div>

          {/* Mobile Tap Button (Visible on phones) */}
          <button
            onClick={handleQuickAdd}
            disabled={isOutOfStock}
            aria-label={`Add ${product.name} to bag`}
            className={`sm:hidden p-2 rounded-xs border transition-colors ${
              isOutOfStock
                ? 'bg-[#181818] border-[#262626] text-[#555]'
                : quickAdded
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                : 'bg-[#161616] border-[#2A2A2A] text-white active:bg-[#D4AF37] active:text-black'
            }`}
          >
            {quickAdded ? <Check className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
