'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import ProductForm from '@/components/product-form';
import { ProductItem } from '@/lib/mock-data';
import { fetchProductById } from '@/lib/product-store';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = (params?.id as string) || '';

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (productId === 'new') {
      router.replace('/admin/products/new');
      return;
    }

    let isMounted = true;

    const syncProduct = async () => {
      setLoading(true);
      console.log('[Edit Product Lookup] Requested product ID:', productId);
      
      const found = await fetchProductById(productId);
      
      if (isMounted) {
        if (found) {
          console.log('[Edit Product Lookup] Supabase product lookup result: SUCCESS', found.id, found.name);
        } else {
          console.warn('[Edit Product Lookup] Supabase product lookup result: NOT FOUND for ID', productId);
        }
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
          No product was found matching ID &quot;{productId}&quot;.
        </p>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold font-mono uppercase tracking-wider hover:bg-[#B3932F] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Products
        </Link>
      </div>
    );
  }

  return <ProductForm initialProduct={product} mode="edit" />;
}
