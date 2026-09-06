'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  SlidersHorizontal, 
  Search, 
  X, 
  Sparkles, 
  ChevronDown, 
  PackageSearch,
  Filter
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { ProductCard } from '@/components/product-card';
import { useProductsStore, isProductPubliclyVisible } from '@/lib/product-store';

export default function ShopPage() {
  const products = useProductsStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCollection, setSelectedCollection] = useState<string>('All');
  const [sortOption, setSortOption] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Extract unique categories & collections from publicly active items
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.filter(isProductPubliclyVisible).forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  const collections = useMemo(() => {
    const set = new Set<string>();
    products.filter(isProductPubliclyVisible).forEach(p => {
      if (p.collection) set.add(p.collection);
      if (p.drop) set.add(p.drop);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered & Sorted products (only show strictly active, published, and active collection items)
  const filteredProducts = useMemo(() => {
    return products
      .filter(isProductPubliclyVisible)
      .filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesCollection = selectedCollection === 'All' || p.collection === selectedCollection || p.drop === selectedCollection;
        const matchesSearch = 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesCollection && matchesSearch;
      })
      .sort((a, b) => {
        if (sortOption === 'price-low') return a.price - b.price;
        if (sortOption === 'price-high') return b.price - a.price;
        if (sortOption === 'newest') return (b.createdAt || '').localeCompare(a.createdAt || '');
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      });
  }, [products, selectedCategory, selectedCollection, sortOption, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* SHOP HERO / HEADER */}
        <div className="border-b border-[#1F1F1F] pb-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold">
                ARCHIVE CATALOGUE
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white mt-1">
                Shop Collection
              </h1>
              <p className="text-xs sm:text-sm text-[#888] font-mono mt-1">
                {filteredProducts.length} GARMENTS AVAILABLE IN SOUTH AFRICA • CURRENCY IN ZAR (R)
              </p>
            </div>

            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search garments..."
                className="w-full bg-[#121212] border border-[#262626] text-white text-xs pl-9 pr-8 py-2.5 rounded-xs placeholder:text-[#555] focus:outline-hidden focus:border-[#D4AF37] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#666] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* DESKTOP FILTER BAR */}
          <div className="mt-6 pt-6 border-t border-[#171717] flex flex-wrap items-center justify-between gap-4">
            {/* Category Chips */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#666] mr-1 hidden sm:inline">
                Category:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xs text-xs font-mono uppercase tracking-wider transition-colors ${
                    selectedCategory === cat
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#141414] text-[#888] hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#666] hidden sm:inline">
                Sort:
              </span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-[#141414] border border-[#262626] text-white text-xs font-mono px-3 py-1.5 rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
              >
                <option value="featured">Featured First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest Releases</option>
              </select>
            </div>
          </div>
        </div>

        {/* PRODUCT GRID */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-[#222] bg-[#0E0E0E] rounded-xs p-8">
            <PackageSearch className="w-12 h-12 text-[#444] mx-auto mb-3" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">No Garments Found</h3>
            <p className="text-xs text-[#777] font-mono mt-1 max-w-sm mx-auto">
              No products match your active filters. Reset filters to view all archive pieces.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedCollection('All');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      <StoreFooter />
    </div>
  );
}
