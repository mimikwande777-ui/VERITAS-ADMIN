'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, PackageSearch } from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { ProductCard } from '@/components/product-card';
import { useProductsStore, isProductPubliclyVisible } from '@/lib/product-store';

export default function CollectionSlugPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const products = useProductsStore();

  const formattedTitle = slug
    .split('-')
    .map(word => word.toUpperCase())
    .join(' ');

  // Check if any product matches this collection
  const allMatchingProducts = products.filter(p => {
    const matchCol = p.collection?.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase();
    const matchDrop = p.drop?.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase();
    const matchTag = p.tags?.some(t => t.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase());
    return matchCol || matchDrop || matchTag;
  });

  // Check if this collection is marked inactive
  const isCollectionInactive = allMatchingProducts.length > 0 && allMatchingProducts.every(p => p.collectionIsActive === false);

  const filteredProducts = products
    .filter(isProductPubliclyVisible)
    .filter(p => {
      const matchCol = p.collection?.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase();
      const matchDrop = p.drop?.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase();
      const matchTag = p.tags?.some(t => t.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase());
      return matchCol || matchDrop || matchTag;
    });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="border-b border-[#1F1F1F] pb-8 mb-8">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#888] hover:text-[#D4AF37] mb-4 uppercase tracking-widest"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Collections</span>
          </Link>

          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold block">
            VERITAS COLLECTION ARCHIVE
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white mt-1">
            {formattedTitle || 'Collection'}
          </h1>
          <p className="text-xs sm:text-sm text-[#888] font-mono mt-1">
            {filteredProducts.length} PIECES DISPATCHED NATIONWIDE • ZAR (R)
          </p>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-[#222] bg-[#0E0E0E] rounded-xs p-8">
            <PackageSearch className="w-12 h-12 text-[#444] mx-auto mb-3" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              {isCollectionInactive ? 'Collection Currently Unavailable' : 'No Pieces Found'}
            </h3>
            <p className="text-xs text-[#777] font-mono mt-1 max-w-md mx-auto">
              {isCollectionInactive 
                ? 'This collection is currently inactive or archived and is not available for purchase.'
                : 'There are no active garments currently available under this collection.'}
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-block px-4 py-2 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors"
            >
              Browse All Active Garments
            </Link>
          </div>
        )}
      </main>

      <StoreFooter />
    </div>
  );
}
