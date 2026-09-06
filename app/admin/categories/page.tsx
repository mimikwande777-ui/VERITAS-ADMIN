'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tags, Plus, Trash2, RefreshCw, AlertCircle, Sparkles, X } from 'lucide-react';
import { 
  fetchCategoriesFromSupabase, 
  createCategoryInSupabase, 
  deleteCategoryInSupabase,
  SupabaseCategoryRow 
} from '@/lib/supabase/categories';
import { fetchProductsFromSupabase } from '@/lib/supabase/products';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<SupabaseCategoryRow[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State for New Category
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [cats, prods] = await Promise.all([
        fetchCategoriesFromSupabase(),
        fetchProductsFromSupabase()
      ]);
      setCategories(cats);

      // Compute product counts per category
      const counts: Record<string, number> = {};
      (prods || []).forEach(p => {
        if (p.category) {
          counts[p.category] = (counts[p.category] || 0) + 1;
        }
      });
      setProductCounts(counts);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setErrorMsg(err?.message || 'Failed to load categories from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    const slug = newSlug.trim() || newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await createCategoryInSupabase({
      title: newTitle.trim(),
      slug,
      description: newDescription.trim()
    });

    setIsSubmitting(false);

    if (result.success) {
      showToast(`Created category "${newTitle}"`);
      setIsCreating(false);
      setNewTitle('');
      setNewSlug('');
      setNewDescription('');
      loadData();
    } else {
      alert(`Error creating category: ${result.error}`);
    }
  };

  const handleDelete = async (cat: SupabaseCategoryRow) => {
    const attachedCount = productCounts[cat.title] || productCounts[cat.slug] || productCounts[cat.id] || 0;
    if (attachedCount > 0) {
      alert(`Cannot delete category "${cat.title}": ${attachedCount} product(s) are assigned to it.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete category "${cat.title}"?`)) return;

    const result = await deleteCategoryInSupabase(cat.id);
    if (result.success) {
      showToast(`Deleted category "${cat.title}"`);
      loadData();
    } else {
      alert(`Error deleting category: ${result.error}`);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161616] border border-[#D4AF37] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs font-medium font-mono">{notification}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Categories</h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            SUPABASE CATEGORIES TABLE • APPAREL TAXONOMY & CLASSIFICATIONS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-[#333] bg-[#111] hover:bg-[#1A1A1A] text-[#888] hover:text-white rounded transition-colors"
            title="Reload from Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </button>
        </div>
      </div>

      {/* CREATE CATEGORY MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#2B2B2B] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">Create Apparel Category</h2>
              <button onClick={() => setIsCreating(false)} className="text-[#666] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#888] mb-1">
                  Category Name *
                </label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }
                  }}
                  placeholder="e.g. T-Shirts, Hoodies, Outerwear"
                  className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#888] mb-1">
                  Slug
                </label>
                <input 
                  type="text" 
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g. t-shirts"
                  className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#888] mb-1">
                  Description
                </label>
                <textarea 
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Category guidelines, sizing standards..."
                  rows={3}
                  className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 border border-[#333] text-xs font-mono text-[#888] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase font-mono tracking-wider hover:bg-[#B3932F] disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving to Database...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/40 text-red-300 p-4 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-[#111] border border-[#1F1F1F] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left font-mono">
            <thead className="text-xs text-[#888] uppercase bg-[#151515] tracking-wider border-b border-[#1F1F1F]">
              <tr>
                <th className="px-6 py-4 font-bold">Slug / Code</th>
                <th className="px-6 py-4 font-bold">Category Title</th>
                <th className="px-6 py-4 font-bold">Description</th>
                <th className="px-6 py-4 font-bold text-right">Products Count</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-[#888] font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto mb-2" />
                    Querying Supabase categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#777]">
                        <Tags className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">NO CATEGORIES CREATED YET</h3>
                      <p className="text-xs text-[#888] font-mono">
                        Categories define the apparel taxonomy for your products and store navigation.
                      </p>
                      <div className="pt-2">
                        <button 
                          onClick={() => setIsCreating(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create First Category
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((category) => {
                  const count = productCounts[category.title] || productCounts[category.slug] || productCounts[category.id] || 0;
                  return (
                    <tr key={category.id} className="hover:bg-[#151515] transition-colors">
                      <td className="px-6 py-4 text-[#888] text-xs">
                        <span className="text-[#D4AF37] font-bold">{category.slug || category.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-white tracking-wide">{category.title}</td>
                      <td className="px-6 py-4 text-[#888] text-xs max-w-xs truncate">{category.description || '—'}</td>
                      <td className="px-6 py-4 font-medium text-right text-white">{count}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-sm bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(category)}
                          className="p-1.5 text-[#666] hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                          title="Delete category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

