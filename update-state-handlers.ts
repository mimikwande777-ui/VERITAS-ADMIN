import fs from 'fs';
let content = fs.readFileSync('components/product-form.tsx', 'utf-8');

// 1. Add selectedColourName state
content = content.replace(
  "  const [newColourName, setNewColourName] = useState('');",
  "  const [selectedColourName, setSelectedColourName] = useState<string>(\n    initialProduct?.colours?.length ? initialProduct.colours[0].name : 'Black'\n  );\n  const [newColourName, setNewColourName] = useState('');"
);

// 2. Replace old toggle size and custom size handlers
content = content.replace(
  `  // Toggle size
  const handleToggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      if (selectedSizes.length <= 1) {
        showToast('A product must contain at least one size.');
        return;
      }
      setSelectedSizes(prev => prev.filter(s => s !== size));
      setVariants(prev => prev.filter(v => v.size !== size));
    } else {
      setSelectedSizes(prev => [...prev, size]);
    }
  };

  const handleAddCustomSize = () => {
    if (!customSizeInput.trim()) return;
    const clean = customSizeInput.trim().toUpperCase();
    if (!selectedSizes.includes(clean)) {
      setSelectedSizes(prev => [...prev, clean]);
    }
    setCustomSizeInput('');
  };`,
  `  // Toggle size
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
  };`
);

// 3. Update media handlers
content = content.replace(
  `  // Media Handlers
  const handleAddImageFromUrl = () => {
    if (!imageUrlInput.trim()) return;
    const newImg: ProductMediaImage = {
      id: getUniqueId('img'),
      url: imageUrlInput.trim(),
      role: imageRoleInput,
      isPrimary: images.length === 0,
      alt: \`\${name} \${imageRoleInput}\`
    };
    setImages(prev => [...prev, newImg]);
    setImageUrlInput('');
    showToast(\`Added image as \${imageRoleInput}\`);
  };

  const handleFileUploadSim = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const previewUrl = URL.createObjectURL(file);
      const newImg: ProductMediaImage = {
        id: getUniqueId('img'),
        url: previewUrl,
        role: imageRoleInput,
        isPrimary: images.length === 0,
        alt: \`\${name} photo\`,
        file: file,
      };
      setImages(prev => [...prev, newImg]);
      showToast(\`Attached image "\${file.name}" as \${imageRoleInput}\`);
    } catch (err) {
      showToast('Failed to process image attachment');
    }
  };

  const handleSetPrimaryImage = (id: string) => {
    setImages(prev => prev.map(img => ({
      ...img,
      isPrimary: img.id === id,
      role: img.id === id ? 'main' : (img.role === 'main' ? 'gallery' : img.role)
    })));
    showToast('Updated primary product image');
  };`,
  `  // Media Handlers
  const handleAddImageFromUrl = (colourName: string) => {
    if (!imageUrlInput.trim()) return;
    const newImg: ProductMediaImage = {
      id: getUniqueId('img'),
      url: imageUrlInput.trim(),
      role: imageRoleInput,
      isPrimary: images.filter(img => img.colourName === colourName).length === 0,
      alt: \`\${name} \${imageRoleInput}\`,
      colourName: colourName
    };
    setImages(prev => [...prev, newImg]);
    setImageUrlInput('');
    showToast(\`Added image as \${imageRoleInput}\`);
  };

  const handleFileUploadSim = async (e: React.ChangeEvent<HTMLInputElement>, colourName: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const previewUrl = URL.createObjectURL(file);
      const newImg: ProductMediaImage = {
        id: getUniqueId('img'),
        url: previewUrl,
        role: imageRoleInput,
        isPrimary: images.filter(img => img.colourName === colourName).length === 0,
        alt: \`\${name} photo\`,
        file: file,
        colourName: colourName
      };
      setImages(prev => [...prev, newImg]);
      showToast(\`Attached image "\${file.name}" as \${imageRoleInput}\`);
    } catch (err) {
      showToast('Failed to process image attachment');
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
  };`
);

fs.writeFileSync('components/product-form.tsx', content);
console.log('State and handlers updated.');
