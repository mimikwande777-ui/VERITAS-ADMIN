'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  Layers,
  Tag,
  Palette,
  Ruler,
  Boxes,
  Printer,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Star,
  Copy,
  Info,
  Shield,
  RotateCcw,
  EyeOff,
  Archive,
  Loader2
} from 'lucide-react';
import { 
  ProductItem, 
  ProductVariant, 
  ProductMediaImage, 
  ProductColour, 
  ProductStatus,
  calculateStockStatus
} from '@/lib/mock-data';
import { 
  getStoredProducts, 
  persistProducts, 
  createProduct,
  updateProduct,
  calculateProfitMetrics, 
  generateSlug, 
  generateVariantSku, 
  calculateProductTotalStock,
  generateDeterministicId
} from '@/lib/product-store';
import { mockProducts } from '@/lib/mock-data';
import { formatZAR, compressImageFile } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { uploadMediaToSupabaseBucket } from '@/lib/supabase/media';
import { createSupabaseProduct, updateSupabaseProduct } from '@/lib/supabase/products';
import { usePWA } from '@/hooks/use-pwa';
import { useAdminAuth } from '@/lib/auth-context';

// Standard preset options
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', 'OS', 'S/M', 'M/L'];

const PRESET_COLOURS = [
  { name: 'Black', code: '#0A0A0A' },
  { name: 'Off-White', code: '#F0EDE6' },
  { name: 'Vintage Washed Black', code: '#1C1C1C' },
  { name: 'Charcoal', code: '#2B2B2B' },
  { name: 'Heather Grey', code: '#666666' },
  { name: 'Navy', code: '#131A26' },
  { name: 'White', code: '#FFFFFF' },
];

const PRINT_PLACEMENTS = [
  'Left Chest',
  'Centre Chest',
  'Full Back',
  'Front and Back',
  'Sleeve',
  'Inside Neck Label',
  'Custom Placement'
];

const PRINT_SIZES = [
  'A4 (21 x 29.7 cm)',
  'A3 (29.7 x 42 cm)',
  '42cm x 50cm (Oversized Back)',
  '10cm x 10cm (Pocket Print)',
  'Custom Dimensions'
];

interface ProductFormProps {
  initialProduct?: ProductItem;
  mode?: 'create' | 'edit';
}

// Deterministic unique ID generator
let entityCounter = 1000;
function getUniqueId(prefix = 'item'): string {
  entityCounter += 1;
  return `${prefix}-${entityCounter}`;
}

export default function ProductForm({ initialProduct, mode = 'create' }: ProductFormProps) {
  const router = useRouter();
  const { isOnline } = usePWA();
  const { hasAccess } = useAdminAuth();
  const canEditPrice = hasAccess('canEditProductPrice');
  const canPublish = hasAccess('canPublishProducts');
  const canEditProduction = hasAccess('canEditProductProduction');
  const canDelete = hasAccess('canDeleteProducts');

  // Basic Information
  const [name, setName] = useState(initialProduct?.name || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(mode === 'edit');
  const [shortDescription, setShortDescription] = useState(initialProduct?.shortDescription || '');
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [specifications, setSpecifications] = useState(initialProduct?.specifications || '');

  // Pricing
  const [price, setPrice] = useState<string>(initialProduct ? String(initialProduct.price) : '');
  const [compareAtPrice, setCompareAtPrice] = useState<string>(initialProduct?.compareAtPrice ? String(initialProduct.compareAtPrice) : '');
  const [costPrice, setCostPrice] = useState<string>(initialProduct?.costPrice ? String(initialProduct.costPrice) : '');

  // Organization
  const [category, setCategory] = useState(initialProduct?.category || 'T-Shirts');
  const [customCategory, setCustomCategory] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [availableCategories, setAvailableCategories] = useState(['T-Shirts', 'Hoodies & Sweats', 'Outerwear', 'Bottoms', 'Headwear', 'Accessories']);

  const [collection, setCollection] = useState(initialProduct?.collection || 'DROP 001');
  const [customCollection, setCustomCollection] = useState('');
  const [isAddingCustomCollection, setIsAddingCustomCollection] = useState(false);
  const [availableCollections, setAvailableCollections] = useState([
    'DROP 001',
    'VERITAS ESSENTIALS',
    'VERITAS PREMIUM',
    'Core Classics',
    'Limited Editions'
  ]);

  const [drop, setDrop] = useState(initialProduct?.drop || 'DROP 001');
  const [tags, setTags] = useState<string[]>(initialProduct?.tags || []);
  const [tagInput, setTagInput] = useState('');

  const [featured, setFeatured] = useState(initialProduct?.featured ?? false);
  const [newArrival, setNewArrival] = useState(initialProduct?.newArrival ?? false);

  // Sales Mode & Availability Lifecycle
  const [salesMode, setSalesMode] = useState<'standard' | 'coming_soon' | 'preorder'>(
    initialProduct?.salesMode || 'standard'
  );
  const [releaseAt, setReleaseAt] = useState<string>(
    initialProduct?.releaseAt ? (initialProduct.releaseAt.includes('T') ? initialProduct.releaseAt.slice(0, 16) : initialProduct.releaseAt) : ''
  );
  const [availabilityMessage, setAvailabilityMessage] = useState<string>(
    initialProduct?.availabilityMessage || ''
  );
  const [preorderNotice, setPreorderNotice] = useState<string>(
    initialProduct?.preorderNotice || 'This item is available for preorder. Payment is collected now. Your order will be prepared once the product is released. We will email you with release and delivery updates.'
  );

  // Load dynamic collections on mount
  useEffect(() => {
    fetch('/api/admin/collections')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.collections)) {
          const names = data.collections.map((c: any) => c.title || c.name).filter(Boolean);
          if (names.length > 0) {
            setAvailableCollections(prev => Array.from(new Set([...prev, ...names])));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Status & Publishing
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status || 'DRAFT');
  const [published, setPublished] = useState<boolean>(initialProduct?.published ?? false);

  // Colours
  const [colours, setColours] = useState<ProductColour[]>(
    initialProduct?.colours?.length ? initialProduct.colours : [
      { name: 'Black', code: '#0A0A0A' }
    ]
  );
  const [selectedColourName, setSelectedColourName] = useState<string>(
    initialProduct?.colours?.length ? initialProduct.colours[0].name : 'Black'
  );
  const [newColourName, setNewColourName] = useState('');
  const [newColourCode, setNewColourCode] = useState('#000000');

  // Sizes & Variant Matrix
  const [selectedSizes, setSelectedSizes] = useState<string[]>(
    initialProduct?.sizes?.length ? initialProduct.sizes : ['S', 'M', 'L', 'XL']
  );
  const [customSizeInput, setCustomSizeInput] = useState('');
  
  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    if (initialProduct?.variants?.length) {
      return initialProduct.variants;
    }
    const initialColours = initialProduct?.colours?.length ? initialProduct.colours : [
      { name: 'Black', code: '#0A0A0A' }
    ];
    const initialSizes = initialProduct?.sizes?.length ? initialProduct.sizes : ['S', 'M', 'L', 'XL'];
    const pName = initialProduct?.name || 'PRODUCT';

    const generated: ProductVariant[] = [];
    initialColours.forEach(c => {
      initialSizes.forEach(s => {
        generated.push({
          id: getUniqueId('var'),
          colour: c.name,
          size: s,
          sku: generateVariantSku(pName, c.name, s),
          stockQuantity: 0,
          lowStockThreshold: 5,
          status: 'OUT OF STOCK',
        });
      });
    });
    return generated;
  });

  // Media
  const [images, setImages] = useState<ProductMediaImage[]>(
    initialProduct?.images?.length ? initialProduct.images : []
  );
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageRoleInput, setImageRoleInput] = useState<'main' | 'front' | 'back' | 'model' | 'gallery'>('gallery');

  // VERITAS Design & Production Info (OTC)
  const [designName, setDesignName] = useState(initialProduct?.designInfo?.designName || '');
  const [designNotes, setDesignNotes] = useState(initialProduct?.designInfo?.designNotes || '');
  const [printPlacement, setPrintPlacement] = useState(initialProduct?.designInfo?.printPlacement || 'Full Back');
  const [printSize, setPrintSize] = useState(initialProduct?.designInfo?.printSize || '42cm x 50cm (Oversized Back)');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auto-generate slug from name unless manually edited
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManuallyEdited) {
      setSlug(generateSlug(val));
    }
  };

  // Regenerate/Sync variant matrix
  const handleRegenerateVariants = () => {
    const existingMap = new Map<string, ProductVariant>();
    variants.forEach(v => {
      existingMap.set(`${v.colour}-${v.size}`, v);
    });

    const newVariants: ProductVariant[] = [];
    colours.forEach(c => {
      selectedSizes.forEach(s => {
        const key = `${c.name}-${s}`;
        const existing = existingMap.get(key);
        if (existing) {
          newVariants.push(existing);
        } else {
          const generatedSku = generateVariantSku(name || 'PRODUCT', c.name, s);
          newVariants.push({
            id: getUniqueId('var'),
            colour: c.name,
            size: s,
            sku: generatedSku,
            stockQuantity: 10,
            lowStockThreshold: 5,
            status: 'IN STOCK',
          });
        }
      });
    });

    setVariants(newVariants);
    showToast(`Generated ${newVariants.length} product variants (${colours.length} colours × ${selectedSizes.length} sizes)`);
  };

  // Add / Remove colours
  const handleAddColour = () => {
    if (!newColourName.trim()) return;
    const exists = colours.some(c => c.name.toLowerCase() === newColourName.trim().toLowerCase());
    if (exists) {
      showToast(`Colour "${newColourName}" is already in the list.`);
      return;
    }
    const updated = [...colours, { name: newColourName.trim(), code: newColourCode }];
    setColours(updated);
    setNewColourName('');
    showToast(`Added colour "${newColourName}"`);
  };

  const handleRemoveColour = (colourName: string) => {
    if (colours.length <= 1) {
      showToast('A product must contain at least one colour.');
      return;
    }
    const updatedColours = colours.filter(c => c.name !== colourName);
    setColours(updatedColours);
    setVariants(prev => prev.filter(v => v.colour !== colourName));
    setImages(prev => prev.filter(img => img.colourName !== colourName));
    if (selectedColourName === colourName) {
      setSelectedColourName(updatedColours[0].name);
    }
    showToast(`Removed colour "${colourName}"`);
  };

  // Toggle size
  const handleToggleVariantSize = (colourName: string, size: string) => {
    setVariants(prev => {
      const exists = prev.some(v => v.colour === colourName && v.size === size);
      if (exists) {
        return prev.filter(v => !(v.colour === colourName && v.size === size));
      } else {
        const newSku = generateVariantSku(name || 'PRODUCT', colourName, size);
        return [...prev, {
          id: getUniqueId('var'),
          colour: colourName,
          size: size,
          sku: newSku,
          stockQuantity: 0,
          lowStockThreshold: 5,
          status: 'OUT OF STOCK'
        }];
      }
    });
  };

  const handleAddCustomVariantSize = (colourName: string) => {
    if (!customSizeInput.trim()) return;
    const clean = customSizeInput.trim().toUpperCase();
    handleToggleVariantSize(colourName, clean);
    setCustomSizeInput('');
  };

  // Update variant stock & threshold
  const handleVariantChange = (id: string, field: keyof ProductVariant, val: any) => {
    setVariants(prev => prev.map(v => {
      if (v.id === id) {
        const updated = { ...v, [field]: val };
        if (field === 'stockQuantity' || field === 'lowStockThreshold') {
          const qty = Number(field === 'stockQuantity' ? val : updated.stockQuantity) || 0;
          const threshold = Number(field === 'lowStockThreshold' ? val : updated.lowStockThreshold) || 5;
          const rawStatus = calculateStockStatus(qty, threshold);
          updated.status = rawStatus.toUpperCase() as 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
        }
        return updated;
      }
      return v;
    }));
  };

  // Bulk update variant quantities
  const handleBulkStockSet = (amount: number) => {
    setVariants(prev => prev.map(v => {
      const qty = Math.max(0, amount);
      const rawStatus = calculateStockStatus(qty, v.lowStockThreshold);
      return {
        ...v,
        stockQuantity: qty,
        status: rawStatus.toUpperCase() as 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK'
      };
    }));
    showToast(`Set stock for all ${variants.length} variants to ${amount}`);
  };

  // Media Handlers
  const handleAddImageFromUrl = (colourName: string) => {
    if (!imageUrlInput.trim()) return;
    const newImg: ProductMediaImage = {
      id: getUniqueId('img'),
      url: imageUrlInput.trim(),
      role: imageRoleInput,
      isPrimary: images.filter(img => img.colourName === colourName).length === 0,
      alt: `${name} ${imageRoleInput}`,
      colourName: colourName
    };
    setImages(prev => [...prev, newImg]);
    setImageUrlInput('');
    showToast(`Added image as ${imageRoleInput}`);
  };

  const handleFileUploadSim = async (e: React.ChangeEvent<HTMLInputElement>, colourName: string) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploadingMedia(true);
    try {
      const selectedFiles = Array.from(fileList);
      const newImagesList: ProductMediaImage[] = [];

      for (const file of selectedFiles) {
        // Create local preview URL immediately
        const previewUrl = URL.createObjectURL(file);
        const newImg: ProductMediaImage = {
          id: getUniqueId('img'),
          url: previewUrl,
          role: imageRoleInput,
          isPrimary: images.filter(img => img.colourName === colourName).length === 0 && newImagesList.length === 0,
          alt: `${name || 'Product'} photo`,
          file: file,
          colourName: colourName
        };
        newImagesList.push(newImg);
      }

      setImages(prev => [...prev, ...newImagesList]);
      showToast(`Added ${newImagesList.length} image(s) for ${colourName}`);
    } catch (err) {
      showToast('Failed to process image attachment. Please try again.');
    } finally {
      setIsUploadingMedia(false);
      // Reset the input value so selecting the same file again works
      e.target.value = '';
    }
  };

  const handleSetPrimaryImage = (id: string, colourName: string) => {
    setImages(prev => prev.map(img => {
      if (img.colourName !== colourName) return img;
      return {
        ...img,
        isPrimary: img.id === id,
        role: img.id === id ? 'main' : (img.role === 'main' ? 'gallery' : img.role)
      };
    }));
    showToast('Updated primary image for ' + colourName);
  };

  const handleRemoveImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (!filtered.some(img => img.isPrimary) && filtered.length > 0) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
    showToast('Image removed');
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;
    const copy = [...images];
    const temp = copy[index];
    copy[index] = copy[newIndex];
    copy[newIndex] = temp;
    setImages(copy);
  };

  // Add / Remove Tags
  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!tagInput.trim()) return;
    if (!tags.includes(tagInput.trim())) {
      setTags(prev => [...prev, tagInput.trim()]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // Calculation summaries
  const numSellingPrice = parseFloat(price) || 0;
  const numCostPrice = parseFloat(costPrice) || 0;
  const numComparePrice = parseFloat(compareAtPrice) || undefined;
  const profitMetrics = calculateProfitMetrics(numSellingPrice, numCostPrice);
  const totalStockSummary = calculateProductTotalStock(variants);

  // Validate for saving / publishing
  const validateProduct = (forPublish: boolean): boolean => {
    const errors: string[] = [];

    if (!name.trim()) {
      errors.push('Product name required');
    }
    
    if (forPublish) {
      if (numSellingPrice <= 0) {
        errors.push('Selling price required (must be greater than R0.00)');
      }
      if (!category.trim()) {
        errors.push('Category required');
      }
      if (!collection.trim()) {
        errors.push('Collection required');
      }
      if (images.length === 0) {
        errors.push('At least one image required');
      }
      if (variants.length === 0) {
        errors.push('At least one variant required');
      }
      if (salesMode === 'preorder' && !releaseAt) {
        errors.push('Release date required for preorder');
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Main Save handler
  const handleSaveAction = async (targetStatus: ProductStatus, targetPublished: boolean) => {
    const isValid = validateProduct(targetPublished);
    if (!isValid) {
      showToast('Cannot publish yet: Please resolve missing required fields.');
      setTimeout(() => {
        const errorEl = document.getElementById('form-validation-summary');
        if (errorEl) {
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          errorEl.focus();
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
      return;
    }

    setIsSubmitting(true);

    const primaryImg = images.find(img => img.isPrimary)?.url || images[0]?.url || '';
    const finalSlug = slug.trim() || generateSlug(name);
    const rootSku = variants[0]?.sku || generateVariantSku(name, colours[0]?.name || 'BLK', variants[0]?.size || 'M');

    const effectivePublished = targetStatus === 'ARCHIVED' ? false : targetPublished;
    const effectiveFeatured = targetStatus === 'ARCHIVED' ? false : featured;

    const productPayload: Partial<ProductItem> = {
      id: initialProduct?.id,
      name: name.trim(),
      slug: finalSlug,
      sku: rootSku,
      shortDescription: shortDescription.trim() || undefined,
      description: description.trim() || `${name} by VERITAS. Constructed with high-grade fabrication.`,
      price: numSellingPrice,
      compareAtPrice: numComparePrice,
      costPrice: numCostPrice > 0 ? numCostPrice : undefined,
      currency: 'ZAR',
      category: category.trim(),
      collection: collection.trim(),
      drop: drop.trim() || 'DROP 001',
      tags: tags.length > 0 ? tags : ['VERITAS', 'DROP 001'],
      status: targetStatus,
      published: effectivePublished,
      featured: effectiveFeatured,
      newArrival,
      active: targetStatus === 'ACTIVE',
      salesMode,
      releaseAt: releaseAt ? (releaseAt.includes('T') ? releaseAt : new Date(releaseAt).toISOString()) : null,
      availabilityMessage: availabilityMessage.trim() || null,
      preorderNotice: salesMode === 'preorder' ? (preorderNotice.trim() || null) : null,
      stockStatus: totalStockSummary.overallStatus === 'IN STOCK' ? 'In Stock' : (totalStockSummary.overallStatus === 'LOW STOCK' ? 'Low Stock' : 'Out of Stock'),
      image: primaryImg,
      galleryImages: images.map(img => img.url),
      images,
      colours,
      sizes: Array.from(new Set(variants.map(v => v.size))),
      variants,
      designInfo: {
        designName: designName.trim(),
        designNotes: designNotes.trim(),
        printPlacement: printPlacement.trim(),
        printSize: printSize.trim(),
      },
      specifications,
      createdAt: initialProduct?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    let savedProduct: ProductItem | null = null;
    let saveError: string | null = null;

    if (isSupabaseConfigured()) {
      if (mode === 'edit' && initialProduct?.id) {
        const res = await updateSupabaseProduct(initialProduct.id, productPayload);
        savedProduct = res.product;
        saveError = res.error;
      } else {
        const res = await createSupabaseProduct(productPayload);
        savedProduct = res.product;
        saveError = res.error;
      }
    } else {
      if (mode === 'edit' && initialProduct?.id) {
        savedProduct = updateProduct(initialProduct.id, productPayload);
      } else {
        savedProduct = createProduct(productPayload);
      }
    }

    if (saveError || !savedProduct || !savedProduct.id) {
      setIsSubmitting(false);
      showToast(saveError || 'Error saving product to database.');
      return;
    }

    const createdId = savedProduct.id;
    const productName = savedProduct.name;

    // Dispatch global sync event to notify all components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('veritas_products_updated'));
    }

    setTimeout(() => {
      setIsSubmitting(false);
      if (targetPublished) {
        showToast(`"${productName}" successfully PUBLISHED to store!`);
      } else if (targetStatus === 'DRAFT') {
        showToast(`"${productName}" saved as DRAFT.`);
      } else {
        showToast(`"${productName}" saved successfully.`);
      }

      router.push(`/admin/products/${createdId}`);
    }, 400);
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

      {/* HEADER */}
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
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold uppercase tracking-widest text-white">
                {mode === 'edit' ? `Edit Product: ${name || 'Item'}` : 'Create New Product'}
              </h1>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded uppercase border ${
                status === 'ACTIVE' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40' :
                status === 'ARCHIVED' ? 'bg-red-950/50 text-red-400 border-red-800/40' :
                'bg-amber-950/50 text-amber-400 border-amber-800/40'
              }`}>
                {status}
              </span>
              {published && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950/50 text-blue-400 border border-blue-800/40">
                  PUBLISHED
                </span>
              )}
            </div>
            <p className="text-xs text-[#888] font-mono mt-1">
              CENTRAL VERITAS PRODUCT DATA ARCHITECTURE • ZAR CURRENCY
            </p>
          </div>
        </div>

        {/* TOP QUICK ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSaveAction('DRAFT', false)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] text-xs font-mono uppercase text-gray-300 transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSaveAction(status === 'DRAFT' ? (canPublish ? 'ACTIVE' : 'DRAFT') : status, canPublish ? published : false)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#1E1E1E] hover:bg-[#282828] border border-[#3A3A3A] text-xs font-mono font-bold uppercase text-white transition-colors disabled:opacity-50"
          >
            Save Product
          </button>
          {canPublish ? (
            <button
              type="button"
              onClick={() => handleSaveAction('ACTIVE', true)}
              disabled={isSubmitting}
              className="flex items-center px-5 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-lg shadow-[#D4AF37]/10"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {isSubmitting ? 'Processing...' : 'Publish to Store'}
            </button>
          ) : (
            <div className="text-[10px] font-mono text-amber-400/80 bg-amber-950/40 border border-amber-900/40 px-3 py-2 rounded">
              PUBLISH: SUPER ADMIN ONLY
            </div>
          )}
        </div>
      </div>

      {/* VALIDATION ERRORS BANNER */}
      {validationErrors.length > 0 && (
        <div 
          id="form-validation-summary"
          tabIndex={-1}
          className="bg-red-950/60 border-2 border-red-600/80 p-5 rounded-sm flex items-start gap-4 text-red-200 animate-in fade-in slide-in-from-top-2 shadow-2xl focus:outline-none ring-2 ring-red-500/30"
        >
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-white flex items-center gap-2">
              <span>CANNOT PUBLISH YET</span>
              <span className="text-[10px] bg-red-900/60 text-red-300 px-2 py-0.5 rounded border border-red-700/60">
                {validationErrors.length} {validationErrors.length === 1 ? 'REQUIREMENT' : 'REQUIREMENTS'}
              </span>
            </h3>
            <p className="text-xs text-red-300 font-mono mt-1 mb-3">
              The following required fields must be completed before this product can be published:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1.5 text-red-100 font-mono">
              {validationErrors.map((err, idx) => (
                <li key={idx} className="font-medium tracking-wide">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT / MAIN COLUMN (2 cols on large screen) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* ==================================================
              SECTION A — BASIC INFORMATION
              ================================================== */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Section A — Basic Information
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#888]">REQUIRED</span>
            </div>

            <div className="space-y-5">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Product Name <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. THE MONOLITH TEE"
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-sm text-white focus:outline-none focus:border-[#D4AF37] placeholder-[#444]"
                />
              </div>

              {/* Slug with auto-gen & manual edit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA]">
                    URL Slug
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSlug(generateSlug(name));
                      setIsSlugManuallyEdited(false);
                      showToast('Slug regenerated from name');
                    }}
                    className="text-[10px] font-mono text-[#D4AF37] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-generate
                  </button>
                </div>
                <div className="flex items-center bg-[#0A0A0A] border border-[#2B2B2B] focus-within:border-[#D4AF37]">
                  <span className="px-3 text-xs font-mono text-[#555] border-r border-[#222]">
                    /products/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setIsSlugManuallyEdited(true);
                    }}
                    placeholder="the-monolith-tee"
                    className="w-full bg-transparent p-3 text-xs font-mono text-[#DDD] focus:outline-none placeholder-[#444]"
                  />
                </div>
                <p className="text-[10px] text-[#666] font-mono mt-1">
                  Unique identifier used in canonical product routing and SEO.
                </p>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Short Description
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="e.g. Custom-milled 280 GSM heavyweight organic Portuguese cotton tee."
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs text-white focus:outline-none focus:border-[#D4AF37] placeholder-[#444]"
                />
              </div>

              {/* Full Description */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Full Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed product story, drape, yarn details, and fit guidance..."
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs text-white focus:outline-none focus:border-[#D4AF37] placeholder-[#444] leading-relaxed"
                />
              </div>

              {/* Fabric Specifications */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Fabric & Construction Specifications
                </label>
                <textarea
                  rows={3}
                  value={specifications}
                  onChange={(e) => setSpecifications(e.target.value)}
                  placeholder="- 100% Organic Heavyweight Cotton (280 GSM)&#10;- Double needle stitch construction"
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37] placeholder-[#444] leading-relaxed"
                />
              </div>
            </div>
          </div>


          {/* ==================================================
              SECTION B — SALES MODE & AVAILABILITY LIFECYCLE
              ================================================== */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Section B — Sales Mode & Availability Lifecycle
                </h2>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                salesMode === 'preorder' ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' :
                salesMode === 'coming_soon' ? 'bg-purple-950/60 text-purple-300 border-purple-800/60' :
                'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              }`}>
                MODE: {salesMode.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-6">
              {/* Sales Mode 3-Way Selector */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-3">
                  Select Product Sales & Distribution Mode <span className="text-[#D4AF37]">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Standard */}
                  <button
                    type="button"
                    onClick={() => setSalesMode('standard')}
                    className={`p-4 text-left border transition-all rounded-sm flex flex-col justify-between ${
                      salesMode === 'standard'
                        ? 'bg-[#181818] border-[#D4AF37] ring-1 ring-[#D4AF37]'
                        : 'bg-[#0E0E0E] border-[#242424] hover:border-[#444]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-mono font-bold uppercase ${salesMode === 'standard' ? 'text-[#D4AF37]' : 'text-white'}`}>
                          Standard Sale
                        </span>
                        {salesMode === 'standard' && <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />}
                      </div>
                      <p className="text-[11px] text-[#888] font-mono leading-relaxed">
                        Regular in-stock production item. Live instant checkout and standard warehouse fulfilment.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-[#555] uppercase mt-3 block">
                      Requires available stock
                    </span>
                  </button>

                  {/* Coming Soon */}
                  <button
                    type="button"
                    onClick={() => setSalesMode('coming_soon')}
                    className={`p-4 text-left border transition-all rounded-sm flex flex-col justify-between ${
                      salesMode === 'coming_soon'
                        ? 'bg-[#181818] border-purple-500 ring-1 ring-purple-500'
                        : 'bg-[#0E0E0E] border-[#242424] hover:border-[#444]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-mono font-bold uppercase ${salesMode === 'coming_soon' ? 'text-purple-400' : 'text-white'}`}>
                          Coming Soon
                        </span>
                        {salesMode === 'coming_soon' && <span className="w-2 h-2 rounded-full bg-purple-400" />}
                      </div>
                      <p className="text-[11px] text-[#888] font-mono leading-relaxed">
                        Public storefront preview before drop. Zero stock allowed. Checkout is disabled until launch.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-purple-400/80 uppercase mt-3 block">
                      Preview / Teaser Mode
                    </span>
                  </button>

                  {/* Preorder */}
                  <button
                    type="button"
                    onClick={() => setSalesMode('preorder')}
                    className={`p-4 text-left border transition-all rounded-sm flex flex-col justify-between ${
                      salesMode === 'preorder'
                        ? 'bg-[#181818] border-amber-500 ring-1 ring-amber-500'
                        : 'bg-[#0E0E0E] border-[#242424] hover:border-[#444]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-mono font-bold uppercase ${salesMode === 'preorder' ? 'text-amber-400' : 'text-white'}`}>
                          Preorder
                        </span>
                        {salesMode === 'preorder' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[11px] text-[#888] font-mono leading-relaxed">
                        Customer preorder before release. Immediate payment capture. Fulfilment starts on release date.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-amber-400/80 uppercase mt-3 block">
                      Advance Ordering
                    </span>
                  </button>
                </div>
              </div>

              {/* Conditional Release Date & Availability Details */}
              <div className="p-4 bg-[#0A0A0A] border border-[#222] rounded-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Release Date */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                      Expected Release Date {salesMode === 'preorder' && <span className="text-amber-400">* (Required)</span>}
                    </label>
                    <input
                      type="datetime-local"
                      value={releaseAt}
                      onChange={(e) => setReleaseAt(e.target.value)}
                      className="w-full bg-[#121212] border border-[#333] p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <p className="text-[10px] text-[#666] font-mono mt-1">
                      {salesMode === 'preorder' ? 'Target release/shipment date disclosed to customers.' : 'Optional projected launch timestamp.'}
                    </p>
                  </div>

                  {/* Availability Message / Badge */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                      Availability Badge / Message
                    </label>
                    <input
                      type="text"
                      value={availabilityMessage}
                      onChange={(e) => setAvailabilityMessage(e.target.value)}
                      placeholder={
                        salesMode === 'coming_soon' ? 'e.g. Dropping Soon — Subscribe for early access' :
                        salesMode === 'preorder' ? 'e.g. Limited Preorder Allocation' :
                        'e.g. In Stock — Ships within 24-48h'
                      }
                      className="w-full bg-[#121212] border border-[#333] p-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37] placeholder-[#444]"
                    />
                    <p className="text-[10px] text-[#666] font-mono mt-1">
                      Visual tag displayed on product cards and storefront product page.
                    </p>
                  </div>
                </div>

                {/* Preorder Notice Textarea (Visible when preorder) */}
                {salesMode === 'preorder' && (
                  <div className="pt-3 border-t border-[#1C1C1C]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-mono uppercase tracking-wider text-amber-300">
                        Customer Preorder Notice & Terms
                      </label>
                      <button
                        type="button"
                        onClick={() => setPreorderNotice('This item is available for preorder. Payment is collected now. Your order will be prepared once the product is released. We will email you with release and delivery updates.')}
                        className="text-[10px] font-mono text-[#D4AF37] hover:underline"
                      >
                        Reset to default notice
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={preorderNotice}
                      onChange={(e) => setPreorderNotice(e.target.value)}
                      className="w-full bg-[#121212] border border-amber-900/40 p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
                    />
                    <p className="text-[10px] text-amber-500/70 font-mono mt-1">
                      Prominently rendered above the &apos;PREORDER NOW&apos; button on the customer product page.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* ==================================================
              SECTION C — PRICING & PROFIT CALCULATIONS
              ================================================== */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Section B — Pricing (ZAR)
                </h2>
              </div>
              {canEditPrice ? (
                <span className="text-[10px] font-mono text-[#D4AF37] bg-[#1C1708] border border-[#D4AF37]/30 px-2 py-0.5 rounded font-bold">
                  STORE CURRENCY: ZAR (R)
                </span>
              ) : (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/50 border border-amber-800/40 px-2 py-0.5 rounded font-bold">
                  SUPER ADMIN ONLY (READ-ONLY)
                </span>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Selling Price */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                    Selling Price (ZAR) <span className="text-[#D4AF37]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-[#D4AF37]">
                      R
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      disabled={!canEditPrice}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="549"
                      className="w-full bg-[#0A0A0A] border border-[#2B2B2B] pl-9 pr-3 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-[#666] font-mono mt-1">
                    Customer display: {formatZAR(numSellingPrice)}
                  </p>
                </div>

                {/* Compare-at Price */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                    Compare-At Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[#666]">
                      R
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      disabled={!canEditPrice}
                      value={compareAtPrice}
                      onChange={(e) => setCompareAtPrice(e.target.value)}
                      placeholder="699"
                      className="w-full bg-[#0A0A0A] border border-[#2B2B2B] pl-9 pr-3 py-3 text-sm font-mono text-[#BBB] focus:outline-none focus:border-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-[#666] font-mono mt-1">
                    Optional original price for strike-through.
                  </p>
                </div>

                {/* Cost Price */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA]">
                      Cost Price
                    </label>
                    <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.2 rounded">
                      PRIVATE
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[#666]">
                      R
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      disabled={!canEditPrice}
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="180"
                      className="w-full bg-[#0A0A0A] border border-[#2B2B2B] pl-9 pr-3 py-3 text-sm font-mono text-[#BBB] focus:outline-none focus:border-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-amber-500/80 font-mono mt-1">
                    PRIVATE — NOT VISIBLE TO CUSTOMERS
                  </p>
                </div>
              </div>

              {/* PROFIT & MARGIN DASHBOARD CARD */}
              <div className="bg-[#151515] border border-[#262626] p-4 rounded-sm">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#888] mb-3 flex items-center justify-between">
                  <span>Unit Profit & Margin Analysis</span>
                  <span className="text-emerald-400 font-bold">
                    Formula: (Price - Cost) / Price
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#0D0D0D] border border-[#222] p-3">
                    <span className="text-[10px] uppercase font-mono text-[#777] block">Profit Per Unit</span>
                    <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                      {formatZAR(profitMetrics.profitPerUnit)}
                    </div>
                  </div>
                  <div className="bg-[#0D0D0D] border border-[#222] p-3">
                    <span className="text-[10px] uppercase font-mono text-[#777] block">Profit Margin</span>
                    <div className="text-lg font-bold font-mono text-[#D4AF37] mt-0.5">
                      {profitMetrics.profitMarginPercent}%
                    </div>
                  </div>
                  <div className="bg-[#0D0D0D] border border-[#222] p-3">
                    <span className="text-[10px] uppercase font-mono text-[#777] block">Cost Markup</span>
                    <div className="text-lg font-bold font-mono text-white mt-0.5">
                      {profitMetrics.markupPercent}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* ==================================================
              SECTION D — PRODUCT COLOURS & INVENTORY
              ================================================== */}
          <div className="bg-[#111] border border-[#1F1F1F] shadow-sm mb-8">
            {/* COLOURS HEADER */}
            <div className="p-6 border-b border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#D4AF37]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Section D — Product Colours & Variants
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-[#888]">
                  {colours.length} ACTIVE {colours.length === 1 ? 'COLOUR' : 'COLOURS'}
                </span>
              </div>

              {/* Existing Colour Badges */}
              <div className="flex flex-wrap gap-2.5">
                {colours.map((col) => (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => setSelectedColourName(col.name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-sm border transition-all ${selectedColourName === col.name ? 'bg-[#1A1A1A] border-[#D4AF37]' : 'bg-[#161616] border-[#2C2C2C] hover:border-[#555]'}`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shadow-inner"
                      style={{ backgroundColor: col.code }}
                    />
                    <span className={`text-xs font-mono font-medium ${selectedColourName === col.name ? 'text-[#D4AF37]' : 'text-white'}`}>{col.name}</span>
                    <span className="text-[10px] font-mono text-[#666] ml-1">{variants.filter(v => v.colour === col.name).length} SKUs</span>
                  </button>
                ))}
              </div>

              {/* Add Custom Colour */}
              <div className="mt-6 bg-[#151515] border border-[#262626] p-4 rounded-sm">
                <div className="text-xs font-mono uppercase tracking-wider text-[#AAA] mb-3">
                  Add New Colourway
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <input
                      type="text"
                      value={newColourName}
                      onChange={(e) => setNewColourName(e.target.value)}
                      placeholder="e.g. Vintage Washed Charcoal"
                      className="w-full bg-[#0A0A0A] border border-[#333] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#333] px-3 py-1.5">
                    <input
                      type="color"
                      value={newColourCode}
                      onChange={(e) => setNewColourCode(e.target.value)}
                      className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-[#AAA]">{newColourCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddColour}
                    className="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#444] text-white text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Add Colour
                  </button>
                </div>
                {/* Preset Fast Selection */}
                <div className="mt-4 pt-3 border-t border-[#222]">
                  <span className="text-[10px] font-mono uppercase text-[#666] block mb-2">
                    Quick Preset Library:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLOURS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          if (!colours.some(c => c.name === preset.name)) {
                            setColours(prev => [...prev, { name: preset.name, code: preset.code }]);
                            setSelectedColourName(preset.name);
                            showToast(`Added ${preset.name}`);
                          }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0A0A0A] border border-[#2B2B2B] hover:border-[#D4AF37] text-[11px] font-mono text-[#CCC] rounded-sm transition-all"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.code }} />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SELECTED COLOUR DETAILS */}
            {selectedColourName && colours.some(c => c.name === selectedColourName) && (
              <div className="p-6 bg-[#161616]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-mono font-bold text-white flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: colours.find(c => c.name === selectedColourName)?.code }} />
                      Managing: {selectedColourName}
                   </h3>
                   <button
                      type="button"
                      onClick={() => handleRemoveColour(selectedColourName)}
                      className="text-xs font-mono text-[#666] hover:text-red-400 flex items-center gap-1 bg-[#111] px-3 py-1.5 border border-[#333] rounded-sm"
                   >
                     <Trash2 className="w-3.5 h-3.5" /> Remove Colour
                   </button>
                </div>

                {/* SIZES & VARIANTS FOR THIS COLOUR */}
                <div className="mb-8 border border-[#262626]">
                  <div className="bg-[#111] p-4 border-b border-[#262626] flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-[#D4AF37]" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-white">Sizes & Inventory</h4>
                     </div>
                     <span className="text-[10px] font-mono text-[#777]">
                        {variants.filter(v => v.colour === selectedColourName).length} SKUs
                     </span>
                  </div>
                  
                  <div className="p-4 bg-[#151515]">
                     <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-2">
                        Active Sizes for {selectedColourName}
                     </label>
                     <div className="flex flex-wrap gap-2 mb-4">
                        {DEFAULT_SIZES.map((size) => {
                          const isActive = variants.some(v => v.colour === selectedColourName && v.size === size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => handleToggleVariantSize(selectedColourName, size)}
                              className={`px-3 py-1.5 text-xs font-mono font-bold transition-all border ${
                                isActive
                                  ? 'bg-[#D4AF37] text-[#0A0A0A] border-[#D4AF37]'
                                  : 'bg-[#0A0A0A] text-[#888] border-[#2B2B2B] hover:border-[#555]'
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                     </div>
                     <div className="flex items-center gap-2 mb-6">
                        <input
                          type="text"
                          value={customSizeInput}
                          onChange={(e) => setCustomSizeInput(e.target.value)}
                          placeholder="Custom size (e.g. 6XL)"
                          className="bg-[#0A0A0A] border border-[#333] px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37] max-w-[200px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCustomVariantSize(selectedColourName)}
                          className="px-3 py-1.5 bg-[#222] hover:bg-[#333] text-xs font-mono uppercase text-white border border-[#444]"
                        >
                          Add Size
                        </button>
                     </div>

                     {/* VARIANTS MATRIX FOR SELECTED COLOUR */}
                     {variants.filter(v => v.colour === selectedColourName).length > 0 && (
                        <div>
                          {/* Desktop Table View */}
                          <div className="hidden md:block overflow-x-auto border border-[#333]">
                             <table className="w-full text-left border-collapse">
                               <thead>
                                 <tr className="bg-[#111] border-b border-[#333] text-[10px] font-mono uppercase text-[#888]">
                                   <th className="py-2.5 px-3">Size</th>
                                   <th className="py-2.5 px-3">SKU</th>
                                   <th className="py-2.5 px-3 text-right">Stock</th>
                                   <th className="py-2.5 px-3 text-right">Low Alert</th>
                                   <th className="py-2.5 px-3 text-center">Status</th>
                                   <th className="py-2.5 px-3 text-center"></th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-[#1F1F1F] text-xs font-mono">
                                 {variants.filter(v => v.colour === selectedColourName).map(v => (
                                   <tr key={v.id} className="hover:bg-[#111] transition-colors bg-[#0A0A0A]">
                                     <td className="py-2.5 px-3 font-bold text-[#D4AF37]">{v.size}</td>
                                     <td className="py-2.5 px-3">
                                        <input
                                          type="text"
                                          value={v.sku}
                                          onChange={(e) => handleVariantChange(v.id, 'sku', e.target.value)}
                                          className="bg-transparent border-b border-[#333] px-1 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-[#D4AF37] w-full max-w-[180px]"
                                        />
                                     </td>
                                     <td className="py-2.5 px-3 text-right">
                                        <input
                                          type="number"
                                          min="0"
                                          value={v.stockQuantity}
                                          onChange={(e) => handleVariantChange(v.id, 'stockQuantity', parseInt(e.target.value) || 0)}
                                          className="bg-[#151515] border border-[#333] px-2 py-1 font-bold text-white text-right focus:outline-none focus:border-[#D4AF37] w-20"
                                        />
                                     </td>
                                     <td className="py-2.5 px-3 text-right">
                                        <input
                                          type="number"
                                          min="1"
                                          value={v.lowStockThreshold}
                                          onChange={(e) => handleVariantChange(v.id, 'lowStockThreshold', parseInt(e.target.value) || 5)}
                                          className="bg-[#151515] border border-[#333] px-2 py-1 text-[11px] text-[#AAA] text-right focus:outline-none focus:border-[#D4AF37] w-16"
                                        />
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
                                     <td className="py-2.5 px-3 text-right">
                                        <button type="button" onClick={() => handleToggleVariantSize(selectedColourName, v.size)} className="text-[#666] hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                     </td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                          </div>

                          {/* Mobile Responsive Cards View */}
                          <div className="block md:hidden space-y-3">
                            {variants.filter(v => v.colour === selectedColourName).map(v => (
                              <div key={v.id} className="bg-[#0D0D0D] border border-[#2B2B2B] p-3.5 rounded-sm space-y-3">
                                <div className="flex items-center justify-between border-b border-[#222] pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 bg-[#1A1A1A] border border-[#333] rounded-xs">
                                      Size {v.size}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                                      v.status === 'IN STOCK' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' :
                                      v.status === 'LOW STOCK' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' :
                                      'bg-red-950/60 text-red-400 border border-red-800/40'
                                    }`}>
                                      {v.status}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVariantSize(selectedColourName, v.size)}
                                    className="text-[#666] hover:text-red-400 p-1.5 transition-colors"
                                    title="Delete Variant"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">SKU</label>
                                  <input
                                    type="text"
                                    value={v.sku}
                                    onChange={(e) => handleVariantChange(v.id, 'sku', e.target.value)}
                                    className="w-full bg-[#141414] border border-[#333] px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">Stock Quantity</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={v.stockQuantity}
                                      onChange={(e) => handleVariantChange(v.id, 'stockQuantity', parseInt(e.target.value) || 0)}
                                      className="w-full bg-[#141414] border border-[#333] px-2.5 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">Low Alert Qty</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={v.lowStockThreshold}
                                      onChange={(e) => handleVariantChange(v.id, 'lowStockThreshold', parseInt(e.target.value) || 5)}
                                      className="w-full bg-[#141414] border border-[#333] px-2.5 py-2 text-xs font-mono text-[#AAA] focus:outline-none focus:border-[#D4AF37]"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                     )}
                  </div>
                </div>

                {/* MEDIA FOR THIS COLOUR */}
                <div className="border border-[#262626]">
                  <div className="bg-[#111] p-4 border-b border-[#262626] flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#D4AF37]" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-white">Media ({selectedColourName})</h4>
                     </div>
                     <span className="text-[10px] font-mono text-[#777]">
                        {images.filter(img => img.colourName === selectedColourName).length} FILES
                     </span>
                  </div>
                  
                  <div className="p-4 bg-[#151515]">
                    {/* Add Image Controls */}
                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mb-6 bg-[#0A0A0A] p-3.5 border border-[#222]">
                      <div className="flex items-center gap-2">
                        <label className="min-h-[44px] flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#222] hover:bg-[#333] active:bg-[#444] border border-[#444] text-xs font-mono uppercase text-white cursor-pointer transition-colors rounded-xs">
                          {isUploadingMedia ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                          ) : (
                            <Upload className="w-4 h-4 text-[#D4AF37]" />
                          )}
                          <span>{isUploadingMedia ? 'Uploading...' : 'Upload Photos'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            disabled={isUploadingMedia}
                            className="hidden" 
                            onChange={(e) => handleFileUploadSim(e, selectedColourName)} 
                          />
                        </label>
                      </div>
                      
                      <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                        <input
                          type="text"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          placeholder="Or paste image URL (https://...)"
                          className="flex-1 min-h-[40px] bg-[#111] border border-[#333] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={imageRoleInput}
                            onChange={(e) => setImageRoleInput(e.target.value as any)}
                            className="flex-1 sm:flex-initial min-h-[40px] bg-[#111] border border-[#333] px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                          >
                            <option value="front">Front View</option>
                            <option value="back">Back View</option>
                            <option value="model">Model View</option>
                            <option value="detail">Detail View</option>
                            <option value="gallery">Gallery</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddImageFromUrl(selectedColourName)}
                            className="min-h-[40px] px-4 py-1.5 bg-[#D4AF37] hover:bg-[#B3932F] text-[#0A0A0A] text-xs font-bold font-mono uppercase rounded-xs"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Media Grid */}
                    {images.filter(img => img.colourName === selectedColourName).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {images.filter(img => img.colourName === selectedColourName).map((img, idx) => (
                          <div key={img.id} className={`group relative aspect-[3/4] bg-[#0A0A0A] border ${img.isPrimary ? 'border-[#D4AF37]' : 'border-[#262626]'} overflow-hidden`}>
                            <img src={img.url} alt={img.alt} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            
                            {img.isPrimary && (
                              <div className="absolute top-2 left-2 bg-[#D4AF37] text-[#0A0A0A] text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase">
                                Primary
                              </div>
                            )}

                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8 flex items-center justify-between">
                              <span className="text-[9px] font-mono uppercase text-[#AAA]">{img.role}</span>
                              <div className="flex gap-1">
                                {!img.isPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimaryImage(img.id, selectedColourName)}
                                    className="p-1 bg-[#222] hover:bg-[#D4AF37] text-white hover:text-black rounded transition-colors"
                                    title="Set as Primary"
                                  >
                                    <Star className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(img.id)}
                                  className="p-1 bg-red-950/80 hover:bg-red-900 text-red-200 rounded transition-colors"
                                  title="Remove Image"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-[#222] text-center">
                        <ImageIcon className="w-8 h-8 text-[#444] mb-3" />
                        <span className="text-xs font-mono uppercase text-[#666]">No media added for {selectedColourName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>



          {/* ==================================================
              SECTION H — VERITAS DESIGN INFORMATION (OTC)
              ================================================== */}
          <div className="bg-[#111] border border-amber-900/40 p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-amber-900/30 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#D4AF37]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Section H — VERITAS Design Information
                </h2>
              </div>
              {canEditProduction ? (
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded">
                  ADMIN / PRODUCTION INFORMATION
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-900 border border-gray-700 px-2 py-0.5 rounded">
                  OPERATIONS & SUPER ADMIN ONLY (READ-ONLY)
                </span>
              )}
            </div>

            <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded mb-5 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/90 font-mono leading-relaxed">
                CONFIDENTIAL: These technical garment specifications are reserved for OTC fulfillment & screenprint manufacturing. They are strictly hidden from the public customer storefront.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Design Name */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                    Design / Artwork Identifier
                  </label>
                  <input
                    type="text"
                    disabled={!canEditProduction}
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="e.g. THE MONOLITH OVERSIZE BACKPRINT"
                    className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Print Placement */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                    Print / Embroidery Placement
                  </label>
                  <select
                    disabled={!canEditProduction}
                    value={printPlacement}
                    onChange={(e) => setPrintPlacement(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {PRINT_PLACEMENTS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Print Size */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Print Scale / Dimensions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    disabled={!canEditProduction}
                    value={printSize}
                    onChange={(e) => setPrintSize(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {PRINT_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    disabled={!canEditProduction}
                    value={printSize}
                    onChange={(e) => setPrintSize(e.target.value)}
                    placeholder="e.g. 42cm x 50cm"
                    className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Design Notes */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Production & Screenprint Notes (OTC Dispatch)
                </label>
                <textarea
                  rows={3}
                  disabled={!canEditProduction}
                  value={designNotes}
                  onChange={(e) => setDesignNotes(e.target.value)}
                  placeholder="e.g. High-density puff ink for front chest logo. Soft-hand discharge screenprint for back typography."
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-3 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37] leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

        </div>


        {/* ==================================================
            RIGHT COLUMN (SIDEBAR / CONTROLS)
            ================================================== */}
        <div className="space-y-8">

          {/* ==================================================
              SECTION I — PUBLISHING STATUS & ACTIONS
              ================================================== */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-mono">
                Section I — Status & Publishing
              </h2>
              {!canPublish && (
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded font-bold">
                  SUPER ADMIN
                </span>
              )}
            </div>

            <div className="space-y-5">
              {/* Product Status (Draft / Active / Archived) */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-2">
                  Catalog Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DRAFT', 'ACTIVE', 'ARCHIVED'] as ProductStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={!canPublish && st !== 'DRAFT'}
                      onClick={() => setStatus(st)}
                      className={`py-2 text-xs font-mono font-bold uppercase transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                        status === st
                          ? (st === 'ACTIVE' ? 'bg-emerald-950 border-emerald-500 text-emerald-300' :
                             st === 'ARCHIVED' ? 'bg-red-950 border-red-500 text-red-300' :
                             'bg-amber-950 border-amber-500 text-amber-300')
                          : 'bg-[#161616] text-[#777] border-[#2A2A2A] hover:border-[#444]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#666] font-mono mt-1.5 leading-relaxed">
                  {status === 'DRAFT' && 'Product is in creation and cannot appear publicly.'}
                  {status === 'ACTIVE' && 'Product is available in catalog and ready for storefront.'}
                  {status === 'ARCHIVED' && 'Product is discontinued or retired from active sale.'}
                </p>
              </div>

              {/* Published Toggle */}
              <div className="pt-4 border-t border-[#1F1F1F]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono uppercase text-white font-bold block">
                      Storefront Visibility
                    </span>
                    <span className="text-[10px] text-[#777] font-mono block mt-0.5">
                      {canPublish ? 'Requires Status = ACTIVE' : 'Super Admin permission required'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!canPublish}
                    onClick={() => {
                      if (!published && status !== 'ACTIVE') {
                        setStatus('ACTIVE');
                      }
                      setPublished(!published);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      published ? 'bg-[#D4AF37]' : 'bg-[#2A2A2A]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        published ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* ACTION BUTTONS IN SIDEBAR */}
              <div className="pt-5 border-t border-[#1F1F1F] space-y-2.5">
                {canPublish && (
                  <button
                    type="button"
                    onClick={() => handleSaveAction('ACTIVE', true)}
                    disabled={isSubmitting || !isOnline}
                    className="w-full py-3 bg-[#D4AF37] hover:bg-[#B3932F] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider font-mono flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {!isOnline ? 'Offline - Cannot Publish' : isSubmitting ? 'Publishing...' : 'Publish to Store'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveAction(status === 'DRAFT' ? (canPublish ? 'ACTIVE' : 'DRAFT') : status, canPublish ? published : false)}
                  disabled={isSubmitting || !isOnline}
                  className="w-full py-2.5 bg-[#1C1C1C] hover:bg-[#262626] border border-[#333] text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!isOnline ? 'Offline - Cannot Save' : 'Save Product'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveAction('DRAFT', false)}
                  disabled={isSubmitting || !isOnline}
                  className="w-full py-2 bg-[#121212] hover:bg-[#181818] border border-[#262626] text-[#888] hover:text-white text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!isOnline ? 'Offline - Cannot Save' : 'Save as Draft'}
                </button>
              </div>
            </div>
          </div>


          {/* ==================================================
              SECTION C — ORGANIZATION
              ================================================== */}
          <div className="bg-[#111] border border-[#1F1F1F] p-6 shadow-sm">
            <div className="border-b border-[#1F1F1F] pb-3 mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-mono">
                Section C — Organization
              </h2>
            </div>

            <div className="space-y-5">
              {/* Category */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Category <span className="text-[#D4AF37]">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setIsAddingCustomCategory(true);
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__add_new__">+ Add New Category...</option>
                </select>

                {isAddingCustomCategory && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="New Category Name"
                      className="bg-[#0A0A0A] border border-[#333] px-2 py-1.5 text-xs font-mono text-white flex-1 focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customCategory.trim()) {
                          setAvailableCategories(prev => [...prev, customCategory.trim()]);
                          setCategory(customCategory.trim());
                          setCustomCategory('');
                          setIsAddingCustomCategory(false);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-mono font-bold"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Collection */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Collection
                </label>
                <select
                  value={collection}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setIsAddingCustomCollection(true);
                    } else {
                      setCollection(e.target.value);
                    }
                  }}
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  {availableCollections.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                  <option value="__add_new__">+ Add New Collection...</option>
                </select>

                {isAddingCustomCollection && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={customCollection}
                      onChange={(e) => setCustomCollection(e.target.value)}
                      placeholder="New Collection Name"
                      className="bg-[#0A0A0A] border border-[#333] px-2 py-1.5 text-xs font-mono text-white flex-1 focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customCollection.trim()) {
                          setAvailableCollections(prev => [...prev, customCollection.trim()]);
                          setCollection(customCollection.trim());
                          setCustomCollection('');
                          setIsAddingCustomCollection(false);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-mono font-bold"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Drop */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Drop
                </label>
                <input
                  type="text"
                  value={drop}
                  onChange={(e) => setDrop(e.target.value)}
                  placeholder="e.g. DROP 001"
                  className="w-full bg-[#0A0A0A] border border-[#2B2B2B] p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#AAA] mb-1.5">
                  Tags & Badges
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Type tag and press enter"
                    className="bg-[#0A0A0A] border border-[#333] px-3 py-1.5 text-xs font-mono text-white flex-1 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 bg-[#222] hover:bg-[#333] text-xs font-mono text-white border border-[#444]"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#181818] border border-[#2A2A2A] text-[11px] font-mono text-[#CCC] rounded-sm"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-[#666] hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Featured & New Arrival Toggles */}
              <div className="pt-4 border-t border-[#1F1F1F] space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0A0A0A] border-[#333] text-[#D4AF37] focus:ring-0"
                  />
                  <span className="text-xs font-mono text-white">Featured on Homepage Hero</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newArrival}
                    onChange={(e) => setNewArrival(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0A0A0A] border-[#333] text-[#D4AF37] focus:ring-0"
                  />
                  <span className="text-xs font-mono text-white">Mark as New Arrival</span>
                </label>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ==================================================
          STICKY MOBILE ACTION BAR (Fixed Bottom for Phones)
          ================================================== */}
      <div 
        id="sticky-mobile-action-bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0C0C0C]/95 backdrop-blur-md border-t border-[#262626] px-3.5 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] shadow-2xl transition-all"
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          {status === 'ARCHIVED' ? (
            <>
              <button
                type="button"
                id="mobile-action-restore-draft"
                onClick={() => {
                  setStatus('DRAFT');
                  setPublished(false);
                  handleSaveAction('DRAFT', false);
                }}
                disabled={isSubmitting || !isOnline}
                className="min-h-[44px] flex-1 px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900/80 active:bg-emerald-900 border border-emerald-500 text-emerald-300 font-mono font-bold text-xs uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {isSubmitting ? 'Restoring...' : 'Restore to Draft'}
              </button>

              <button
                type="button"
                id="mobile-action-save-archived"
                onClick={() => handleSaveAction('ARCHIVED', false)}
                disabled={isSubmitting || !isOnline}
                className="min-h-[44px] px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] active:bg-[#333] border border-[#333] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xs transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : published ? (
            <>
              <button
                type="button"
                id="mobile-action-save-published"
                onClick={() => handleSaveAction('ACTIVE', true)}
                disabled={isSubmitting || !isOnline}
                className="min-h-[44px] flex-1 px-3 py-2 bg-[#1C1C1C] hover:bg-[#262626] active:bg-[#333] border border-[#3A3A3A] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xs transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>

              {canPublish && (
                <button
                  type="button"
                  id="mobile-action-unpublish"
                  onClick={() => {
                    setPublished(false);
                    setStatus('DRAFT');
                    handleSaveAction('DRAFT', false);
                  }}
                  disabled={isSubmitting || !isOnline}
                  className="min-h-[44px] flex-1 px-3 py-2 bg-amber-950/40 hover:bg-amber-900/50 active:bg-amber-900/70 border border-amber-600/50 text-amber-300 font-mono font-bold text-xs uppercase tracking-wider rounded-xs transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Updating...' : 'Unpublish'}
                </button>
              )}

              <button
                type="button"
                id="mobile-action-archive"
                onClick={() => {
                  setStatus('ARCHIVED');
                  setPublished(false);
                  handleSaveAction('ARCHIVED', false);
                }}
                disabled={isSubmitting || !isOnline}
                className="min-h-[44px] px-3 py-2 bg-[#141414] hover:bg-[#202020] active:bg-red-950/40 border border-[#2B2B2B] text-[#888] hover:text-red-400 font-mono text-xs uppercase rounded-xs transition-all active:scale-[0.98] disabled:opacity-50"
                title="Archive Product"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                id="mobile-action-save-draft"
                onClick={() => handleSaveAction('DRAFT', false)}
                disabled={isSubmitting || !isOnline}
                className="min-h-[44px] flex-1 px-3 py-2 bg-[#1A1A1A] hover:bg-[#222] active:bg-[#2A2A2A] border border-[#333] text-[#CCC] font-mono font-bold text-xs uppercase tracking-wider rounded-xs transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-[#888]" />
                {isSubmitting ? 'Saving...' : 'Save Draft'}
              </button>

              {canPublish ? (
                <button
                  type="button"
                  id="mobile-action-publish-product"
                  onClick={() => handleSaveAction('ACTIVE', true)}
                  disabled={isSubmitting || !isOnline}
                  className="min-h-[44px] flex-[1.3] px-3.5 py-2 bg-[#D4AF37] hover:bg-[#C29E30] active:bg-[#A38224] text-[#0A0A0A] font-mono font-bold text-xs uppercase tracking-wider rounded-xs transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-[#D4AF37]/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? 'Publishing...' : 'Publish Product'}
                </button>
              ) : (
                <button
                  type="button"
                  id="mobile-action-save-product"
                  onClick={() => handleSaveAction('DRAFT', false)}
                  disabled={isSubmitting || !isOnline}
                  className="min-h-[44px] flex-1 px-3 py-2 bg-[#1E1E1E] border border-[#333] text-white font-mono font-bold text-xs uppercase rounded-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              )}

              {mode === 'edit' && initialProduct && (
                <button
                  type="button"
                  id="mobile-action-archive-draft"
                  onClick={() => {
                    setStatus('ARCHIVED');
                    setPublished(false);
                    handleSaveAction('ARCHIVED', false);
                  }}
                  disabled={isSubmitting || !isOnline}
                  className="min-h-[44px] px-3 py-2 bg-[#141414] hover:bg-[#202020] active:bg-red-950/40 border border-[#2B2B2B] text-[#888] hover:text-red-400 font-mono text-xs uppercase rounded-xs transition-all active:scale-[0.98] disabled:opacity-50"
                  title="Archive Product"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
