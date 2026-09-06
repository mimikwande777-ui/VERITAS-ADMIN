import fs from 'fs';
let content = fs.readFileSync('components/product-form.tsx', 'utf-8');

content = content.replace(
  `  const handleRemoveColour = (colourName: string) => {
    if (colours.length <= 1) {
      showToast('A product must contain at least one colour.');
      return;
    }
    setColours(prev => prev.filter(c => c.name !== colourName));
    setVariants(prev => prev.filter(v => v.colour !== colourName));
    showToast(\`Removed colour "\${colourName}"\`);
  };`,
  `  const handleRemoveColour = (colourName: string) => {
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
    showToast(\`Removed colour "\${colourName}"\`);
  };`
);

fs.writeFileSync('components/product-form.tsx', content);
console.log('Fixed remove colour');
