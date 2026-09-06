import fs from 'fs';
let content = fs.readFileSync('components/product-form.tsx', 'utf-8');

content = content.replace(
  "const rootSku = variants[0]?.sku || generateVariantSku(name, colours[0]?.name || 'BLK', selectedSizes[0] || 'M');",
  "const rootSku = variants[0]?.sku || generateVariantSku(name, colours[0]?.name || 'BLK', variants[0]?.size || 'M');"
);

content = content.replace(
  "sizes: selectedSizes,",
  "sizes: Array.from(new Set(variants.map(v => v.size))),"
);

fs.writeFileSync('components/product-form.tsx', content);
console.log('Fixed handleSaveAction');
