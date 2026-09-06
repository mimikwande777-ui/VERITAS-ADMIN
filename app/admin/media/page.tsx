'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  Folder, 
  Trash2, 
  Plus, 
  Check, 
  Link as LinkIcon, 
  RefreshCw, 
  AlertCircle, 
  Sparkles, 
  X,
  ExternalLink,
  Copy,
  Layers
} from 'lucide-react';
import { 
  fetchAllMediaFromSupabase, 
  createProductMediaInSupabase, 
  deleteMediaFromSupabase,
  uploadMediaToSupabaseBucket,
  getProductMediaUrl,
  AdminMediaAsset 
} from '@/lib/supabase/media';
import { fetchProductsFromSupabase, SupabaseProductWithDetails } from '@/lib/supabase/products';

export default function MediaLibraryPage() {
  const [mediaList, setMediaList] = useState<AdminMediaAsset[]>([]);
  const [products, setProducts] = useState<SupabaseProductWithDetails[]>([]);
  const [selectedProductFilter, setSelectedProductFilter] = useState('All Media');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add Asset / Modal State
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('file');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedColourId, setSelectedColourId] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [altTextInput, setAltTextInput] = useState('');
  const [mediaTypeInput, setMediaTypeInput] = useState('front');
  const [isPrimaryInput, setIsPrimaryInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewModalAsset, setPreviewModalAsset] = useState<AdminMediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [media, prods] = await Promise.all([
        fetchAllMediaFromSupabase(),
        fetchProductsFromSupabase()
      ]);
      setMediaList(media);
      setProducts(prods || []);
      if (prods && prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load media assets:', err);
      showToast(`Failed to load media: ${err?.message || 'Unknown error'}`, 'error');
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

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleAddMediaRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Please select a target product', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalStoragePath = '';

      if (uploadMode === 'file') {
        if (!fileInput) {
          showToast('Please select an image file to upload', 'error');
          setIsSubmitting(false);
          return;
        }

        const uploadRes = await uploadMediaToSupabaseBucket(fileInput, selectedProductId);
        if (!uploadRes.success || !uploadRes.storagePath) {
          showToast(`Storage upload failed: ${uploadRes.error}`, 'error');
          setIsSubmitting(false);
          return;
        }
        finalStoragePath = uploadRes.storagePath;
      } else {
        if (!urlInput.trim()) {
          showToast('Please provide a valid image URL', 'error');
          setIsSubmitting(false);
          return;
        }
        finalStoragePath = urlInput.trim();
      }

      const res = await createProductMediaInSupabase(
        selectedProductId,
        finalStoragePath,
        mediaTypeInput,
        altTextInput.trim() || 'Product Asset',
        isPrimaryInput,
        selectedColourId || null
      );

      setIsSubmitting(false);

      if (res.success) {
        showToast('Media asset successfully attached to product in Supabase.');
        setIsAddingUrl(false);
        setUrlInput('');
        setFileInput(null);
        setAltTextInput('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadData();
      } else {
        showToast(`Failed to attach media: ${res.error}`, 'error');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      showToast(`Unexpected error: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this media record from Supabase?')) return;

    const res = await deleteMediaFromSupabase(id);
    if (res.success) {
      showToast('Media asset removed from Supabase.');
      if (previewModalAsset?.id === id) {
        setPreviewModalAsset(null);
      }
      await loadData();
    } else {
      showToast(`Failed to delete media asset: ${res.error}`, 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Asset URL copied to clipboard');
  };

  const filteredMedia = mediaList.filter(item => {
    if (selectedProductFilter === 'All Media') return true;
    return item.product_name === selectedProductFilter || item.product_id === selectedProductFilter;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 border px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in ${
          notification.type === 'error'
            ? 'bg-[#200A0A] border-red-500/60 text-red-200'
            : 'bg-[#161616] border-[#D4AF37] text-white'
        }`}>
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          )}
          <span className="text-xs font-medium font-mono">{notification.message}</span>
        </div>
      )}

      {/* BANNER */}
      <div className="bg-[#121212] border border-[#262626] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-[#D4AF37]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong className="text-white">SUPABASE STORAGE & CDN:</strong> Assets hosted in bucket <code className="text-[#D4AF37]">product-media</code> & synced with table <code className="text-[#D4AF37]">product_media</code>.
          </span>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A1A1A] hover:bg-[#262626] text-white rounded border border-[#333] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          Refresh Supabase
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Media Library</h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            PRODUCT PHOTOGRAPHY, CDN STORAGE & HIGH-RESOLUTION COLORWAY ASSETS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddingUrl(!isAddingUrl)}
            className="px-4 py-2 border border-[#333] text-xs font-bold font-mono uppercase tracking-wider bg-[#111] hover:bg-[#181818] text-white transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
            Upload / Attach Media
          </button>
        </div>
      </div>

      {isAddingUrl && (
        <form onSubmit={handleAddMediaRecord} className="bg-[#111] border border-[#2B2B2B] p-5 space-y-4 shadow-xl font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#222] pb-2">
            <div className="flex items-center gap-4">
              <h3 className="font-bold uppercase text-white tracking-wider">Attach Media Asset</h3>
              <div className="flex bg-[#0A0A0A] p-0.5 border border-[#333] rounded">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`px-3 py-1 text-[10px] uppercase font-bold rounded-sm transition-colors ${
                    uploadMode === 'file' ? 'bg-[#D4AF37] text-[#0A0A0A]' : 'text-[#888] hover:text-white'
                  }`}
                >
                  File Upload (Bucket)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('url')}
                  className={`px-3 py-1 text-[10px] uppercase font-bold rounded-sm transition-colors ${
                    uploadMode === 'url' ? 'bg-[#D4AF37] text-[#0A0A0A]' : 'text-[#888] hover:text-white'
                  }`}
                >
                  Direct URL
                </button>
              </div>
            </div>
            <button type="button" onClick={() => setIsAddingUrl(false)} className="text-[#666] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase text-[#888] mb-1">Target Product *</label>
              <select 
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setSelectedColourId('');
                }}
                className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-white text-xs focus:border-[#D4AF37] focus:outline-none"
                required
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku || p.id.slice(0, 8)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#888] mb-1">Colorway Tag (Optional)</label>
              <select 
                value={selectedColourId}
                onChange={(e) => setSelectedColourId(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-white text-xs focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="">No specific colorway (All)</option>
                {selectedProduct?.colours?.map(c => (
                  <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#888] mb-1">Media Slot / Type *</label>
              <select 
                value={mediaTypeInput}
                onChange={(e) => setMediaTypeInput(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-white text-xs focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="front">Front Shot (Standard)</option>
                <option value="back">Back Shot</option>
                <option value="detail">Detail / Fabric Texture</option>
                <option value="model">Model / Lifestyle</option>
                <option value="gallery">General Gallery Asset</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#888] mb-1">Alt Text / Description</label>
              <input 
                type="text" 
                value={altTextInput}
                onChange={(e) => setAltTextInput(e.target.value)}
                placeholder="e.g. Front studio shot in Obsidian Black" 
                className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-white text-xs focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-[10px] uppercase text-[#888] mb-1">Select Image File (Supabase Storage product-media bucket) *</label>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                    className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-white text-xs focus:border-[#D4AF37] focus:outline-none file:mr-4 file:py-1 file:px-3 file:border-0 file:text-xs file:font-mono file:bg-[#1F1F1F] file:text-[#D4AF37] hover:file:bg-[#2A2A2A]"
                    required={uploadMode === 'file'}
                  />
                  {fileInput && (
                    <p className="text-[10px] text-[#888] mt-1">
                      File: {fileInput.name} ({(fileInput.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] uppercase text-[#888] mb-1">Image CDN / Storage URL *</label>
                  <input 
                    type="url" 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://... or Supabase storage path" 
                    className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-white text-xs focus:border-[#D4AF37] focus:outline-none"
                    required={uploadMode === 'url'}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-white">
                <input 
                  type="checkbox" 
                  checked={isPrimaryInput}
                  onChange={(e) => setIsPrimaryInput(e.target.checked)}
                  className="accent-[#D4AF37]"
                />
                <span>Set as Primary Thumbnail for Product</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#222]">
            <button 
              type="button" 
              onClick={() => setIsAddingUrl(false)} 
              className="px-4 py-2 border border-[#333] text-xs text-[#888] hover:text-white"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving Asset...
                </>
              ) : (
                'Save to Supabase'
              )}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Product Filter Sidebar */}
        <div className="w-full md:w-64 bg-[#111] border border-[#1F1F1F] p-4 shadow-sm h-fit">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-200 mb-4 border-b border-[#1F1F1F] pb-2 font-mono">
            Filter by Product
          </h2>
          <ul className="space-y-1">
            <li>
              <button 
                onClick={() => setSelectedProductFilter('All Media')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono font-medium rounded-sm transition-colors ${
                  selectedProductFilter === 'All Media' 
                    ? 'bg-[#1A1A1A] text-white border-l-2 border-[#D4AF37]' 
                    : 'text-[#888] hover:bg-[#151515] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-[#D4AF37]" />
                  All Media Assets
                </div>
                <span className="text-[10px] text-[#555] font-mono">{mediaList.length}</span>
              </button>
            </li>
            {products.map(p => {
              const count = mediaList.filter(m => m.product_id === p.id || m.product_name === p.name).length;
              return (
                <li key={p.id}>
                  <button 
                    onClick={() => setSelectedProductFilter(p.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono font-medium rounded-sm transition-colors ${
                      selectedProductFilter === p.name 
                        ? 'bg-[#1A1A1A] text-white border-l-2 border-[#D4AF37]' 
                        : 'text-[#888] hover:bg-[#151515] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate max-w-[170px]">
                      <Folder className="w-3.5 h-3.5 text-[#555] shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <span className="text-[10px] text-[#555] font-mono">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Media Grid Canvas */}
        <div className="flex-1 bg-[#111] border border-[#1F1F1F] p-6 shadow-sm min-h-[400px]">
          {loading ? (
            <div className="py-20 text-center text-xs font-mono text-[#888]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto mb-2" />
              Loading media assets from Supabase...
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded bg-[#161616] border border-[#222] flex items-center justify-center text-[#555] mb-4">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                No Media Found in {selectedProductFilter}
              </h3>
              <p className="text-xs text-[#777] font-mono max-w-sm mt-1 mb-6">
                Attach imagery directly to this product or upload image files to Supabase Storage.
              </p>
              <button 
                onClick={() => setIsAddingUrl(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold font-mono uppercase tracking-wider hover:bg-[#B3932F]"
              >
                <Plus className="w-4 h-4" />
                Attach First Asset
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {filteredMedia.map((item) => {
                const displayUrl = item.public_url || getProductMediaUrl(item.storage_path);
                return (
                  <div 
                    key={item.id} 
                    onClick={() => setPreviewModalAsset(item)}
                    className="group relative aspect-square bg-[#0A0A0A] border border-[#262626] hover:border-[#D4AF37] overflow-hidden rounded cursor-pointer transition-all duration-200"
                  >
                    {/* Media Image with Fallback */}
                    <img 
                      src={displayUrl} 
                      alt={item.alt_text || item.product_name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // Fallback to placeholder if url fails to load
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80';
                      }}
                    />

                    {/* Primary Badge */}
                    {item.is_primary && (
                      <span className="absolute top-2 left-2 z-10 text-[8px] font-mono font-bold bg-[#D4AF37] text-[#0A0A0A] px-1.5 py-0.5 uppercase tracking-wider rounded-sm shadow-md">
                        PRIMARY
                      </span>
                    )}

                    {/* Colorway Badge */}
                    {item.colour_name && (
                      <span className="absolute top-2 right-2 z-10 text-[8px] font-mono bg-black/80 text-white border border-[#444] px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                        {item.colour_hex && (
                          <span 
                            className="w-2 h-2 rounded-full inline-block border border-white/20" 
                            style={{ backgroundColor: item.colour_hex }} 
                          />
                        )}
                        {item.colour_name}
                      </span>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-mono font-bold bg-[#222] text-[#D4AF37] border border-[#333] px-1.5 py-0.5 uppercase">
                          {item.media_type}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(displayUrl);
                            }}
                            className="p-1 bg-[#222] hover:bg-[#333] text-[#CCC] hover:text-white rounded"
                            title="Copy Public URL"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            className="p-1 bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white rounded"
                            title="Delete from Supabase"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-white truncate space-y-0.5">
                        <div className="font-bold truncate text-[#EEE]">{item.product_name}</div>
                        <div className="text-[9px] text-[#888] truncate">{item.alt_text || item.storage_path}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ASSET PREVIEW MODAL */}
      {previewModalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-2xl shadow-2xl p-6 rounded font-mono text-xs text-white">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
              <h3 className="font-bold uppercase tracking-wider text-sm text-[#D4AF37] flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Asset Inspection
              </h3>
              <button 
                onClick={() => setPreviewModalAsset(null)}
                className="text-[#888] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="aspect-square bg-black border border-[#222] rounded overflow-hidden flex items-center justify-center">
                <img 
                  src={previewModalAsset.public_url || getProductMediaUrl(previewModalAsset.storage_path)} 
                  alt={previewModalAsset.alt_text || previewModalAsset.product_name}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-[#777] uppercase">Product</div>
                  <div className="font-bold text-white text-sm">{previewModalAsset.product_name}</div>
                </div>

                <div>
                  <div className="text-[10px] text-[#777] uppercase">Slot & Role</div>
                  <div className="inline-block mt-0.5 px-2 py-0.5 bg-[#222] text-[#D4AF37] border border-[#333] uppercase text-[10px] font-bold">
                    {previewModalAsset.media_type} {previewModalAsset.is_primary && '• (Primary)'}
                  </div>
                </div>

                {previewModalAsset.colour_name && (
                  <div>
                    <div className="text-[10px] text-[#777] uppercase">Colourway Association</div>
                    <div className="flex items-center gap-2 mt-1">
                      {previewModalAsset.colour_hex && (
                        <span 
                          className="w-3.5 h-3.5 rounded-full border border-white/30" 
                          style={{ backgroundColor: previewModalAsset.colour_hex }} 
                        />
                      )}
                      <span>{previewModalAsset.colour_name}</span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] text-[#777] uppercase">Storage Path / File</div>
                  <div className="text-[#AAA] break-all select-all bg-[#0A0A0A] p-2 border border-[#222] rounded mt-0.5 text-[11px]">
                    {previewModalAsset.storage_path}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#777] uppercase">Resolved Public CDN URL</div>
                  <div className="text-[#888] break-all select-all bg-[#0A0A0A] p-2 border border-[#222] rounded mt-0.5 text-[10px] max-h-16 overflow-y-auto">
                    {previewModalAsset.public_url || getProductMediaUrl(previewModalAsset.storage_path)}
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() => copyToClipboard(previewModalAsset.public_url || getProductMediaUrl(previewModalAsset.storage_path))}
                    className="flex-1 py-2 bg-[#222] hover:bg-[#2C2C2C] border border-[#444] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 rounded transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy CDN URL
                  </button>
                  <button
                    onClick={() => handleDelete(previewModalAsset.id)}
                    className="py-2 px-4 bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


