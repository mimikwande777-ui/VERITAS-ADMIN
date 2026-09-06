'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, Plus, Trash2, Check, RefreshCw, AlertCircle, Sparkles, X, Power } from 'lucide-react';
import { 
  fetchCollectionsFromSupabase, 
  createCollectionInSupabase, 
  toggleCollectionStatusInSupabase, 
  deleteCollectionInSupabase,
  SupabaseCollectionRow 
} from '@/lib/supabase/collections';
import { fetchProductsFromSupabase } from '@/lib/supabase/products';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<SupabaseCollectionRow[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State for New Collection
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [cols, prods] = await Promise.all([
        fetchCollectionsFromSupabase(),
        fetchProductsFromSupabase()
      ]);
      setCollections(cols);

      // Compute product counts per collection id / name / slug
      const counts: Record<string, number> = {};
      cols.forEach(col => {
        const attached = (prods || []).filter(p => 
          p.collectionId === col.id || 
          p.collection === col.title || 
          p.collection === col.name || 
          p.collection === col.handle || 
          p.collection === col.slug
        );
        counts[col.id] = attached.length;
      });
      setProductCounts(counts);
    } catch (err: any) {
      console.error('Failed to load collections:', err);
      setErrorMsg(err?.message || 'Failed to load collections from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    queueMicrotask(async () => {
      if (mounted) {
        await loadData();
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    const handle = newHandle.trim() || newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await createCollectionInSupabase({
      title: newTitle.trim(),
      handle,
      description: newDescription.trim(),
      is_active: true
    });

    setIsSubmitting(false);

    if (result.success) {
      showToast(`Created collection "${newTitle}"`);
      setIsCreating(false);
      setNewTitle('');
      setNewHandle('');
      setNewDescription('');
      loadData();
    } else {
      alert(`Error creating collection: ${result.error}`);
    }
  };

  const handleToggleStatus = async (col: SupabaseCollectionRow) => {
    const nextStatus = !col.is_active;
    setTogglingId(col.id);
    const result = await toggleCollectionStatusInSupabase(col.id, nextStatus);
    setTogglingId(null);
    if (result.success && result.collection) {
      const verifiedStatus = result.collection.is_active;
      showToast(`Collection "${col.title}" set to ${verifiedStatus ? 'ACTIVE' : 'INACTIVE'} (Verified in Supabase)`);
      // Update with verified record from database
      setCollections(prev => prev.map(c => c.id === col.id ? { ...c, is_active: verifiedStatus } : c));
      // Dispatch global sync event to notify public storefront & store caches
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('veritas_products_updated'));
      }
      await loadData();
    } else {
      showToast(`Failed to update status: ${result.error}`);
    }
  };

  const handleDelete = async (col: SupabaseCollectionRow) => {
    const attachedCount = productCounts[col.id] || 0;
    if (attachedCount > 0) {
      alert(`Cannot delete collection "${col.title}": ${attachedCount} product(s) are currently attached to it.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete collection "${col.title}"?`)) return;

    const result = await deleteCollectionInSupabase(col.id);
    if (result.success) {
      showToast(`Deleted collection "${col.title}"`);
      loadData();
    } else {
      alert(`Error deleting collection: ${result.error}`);
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
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Collections & Drops</h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            SUPABASE COLLECTIONS TABLE • CURATED DROPS & PRODUCT GROUPS
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
            Create Collection
          </button>
        </div>
      </div>

      {/* CREATE COLLECTION MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#2B2B2B] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">Create New Drop Collection</h2>
              <button onClick={() => setIsCreating(false)} className="text-[#666] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#888] mb-1">
                  Collection Title *
                </label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newHandle) {
                      setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }
                  }}
                  placeholder="e.g. DROP 001 - THE MONOLITH"
                  className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#888] mb-1">
                  Slug / Handle
                </label>
                <input 
                  type="text" 
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="e.g. drop-001"
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
                  placeholder="Drop concept, editorial narrative..."
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
                  {isSubmitting ? 'Saving to Database...' : 'Save Collection'}
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
                <th className="px-6 py-4 font-bold">Handle / ID</th>
                <th className="px-6 py-4 font-bold">Collection Title</th>
                <th className="px-6 py-4 font-bold">Description</th>
                <th className="px-6 py-4 font-bold text-right">Attached Products</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-[#888] font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto mb-2" />
                    Querying Supabase collections...
                  </td>
                </tr>
              ) : collections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#777]">
                        <Layers className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">NO COLLECTIONS FOUND IN SUPABASE</h3>
                      <p className="text-xs text-[#888] font-mono">
                        Create drop capsules to organize your inventory into distinct releases.
                      </p>
                      <div className="pt-2">
                        <button 
                          onClick={() => setIsCreating(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create First Collection
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                collections.map((col) => {
                  const count = productCounts[col.id] || 0;
                  const isToggling = togglingId === col.id;
                  return (
                    <tr key={col.id} className="hover:bg-[#151515] transition-colors">
                      <td className="px-6 py-4 text-[#888] text-xs">
                        <span className="text-[#D4AF37] font-bold">{col.handle || col.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-white tracking-wide">{col.title}</td>
                      <td className="px-6 py-4 text-[#888] text-xs max-w-xs truncate">{col.description || '—'}</td>
                      <td className="px-6 py-4 font-medium text-right text-white">{count}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(col)}
                          disabled={isToggling}
                          title="Click to toggle status in Supabase"
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-sm border transition-colors disabled:opacity-50 ${
                            col.is_active 
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/60' 
                              : 'bg-red-950/40 text-red-400 border-red-800/40 hover:bg-red-900/60'
                          }`}
                        >
                          <Power className={`w-2.5 h-2.5 ${isToggling ? 'animate-spin' : ''}`} />
                          {isToggling ? 'Updating...' : col.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(col)}
                          className="p-1.5 text-[#666] hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                          title="Delete collection"
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

