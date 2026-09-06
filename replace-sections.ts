import fs from 'fs';
const content = fs.readFileSync('components/product-form.tsx', 'utf-8');
const startMarker = '          {/* ==================================================\n              SECTION D — PRODUCT COLOURS';
const endMarker = '          {/* ==================================================\n              SECTION H — VERITAS DESIGN INFORMATION (OTC)';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find markers');
  process.exit(1);
}

const replacement = `          {/* ==================================================
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
                    className={\`flex items-center gap-2 px-3 py-2 rounded-sm border transition-all \${selectedColourName === col.name ? 'bg-[#1A1A1A] border-[#D4AF37]' : 'bg-[#161616] border-[#2C2C2C] hover:border-[#555]'}\`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shadow-inner"
                      style={{ backgroundColor: col.code }}
                    />
                    <span className={\`text-xs font-mono font-medium \${selectedColourName === col.name ? 'text-[#D4AF37]' : 'text-white'}\`}>{col.name}</span>
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
                            showToast(\`Added \${preset.name}\`);
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
                              className={\`px-3 py-1.5 text-xs font-mono font-bold transition-all border \${
                                isActive
                                  ? 'bg-[#D4AF37] text-[#0A0A0A] border-[#D4AF37]'
                                  : 'bg-[#0A0A0A] text-[#888] border-[#2B2B2B] hover:border-[#555]'
                              }\`}
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
                        <div className="overflow-x-auto border border-[#333]">
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
                                      <span className={\`inline-block px-2 py-0.5 rounded text-[9px] font-bold \${
                                        v.status === 'IN STOCK' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' :
                                        v.status === 'LOW STOCK' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' :
                                        'bg-red-950/40 text-red-400 border border-red-800/40'
                                      }\`}>
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
                    <div className="flex flex-wrap items-center gap-3 mb-6 bg-[#0A0A0A] p-3 border border-[#222]">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-mono uppercase text-white cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload File</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUploadSim(e, selectedColourName)} />
                        </label>
                        <span className="text-[10px] font-mono text-[#666]">OR URL:</span>
                      </div>
                      
                      <div className="flex-1 flex items-center gap-2 min-w-[280px]">
                        <input
                          type="text"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 bg-[#111] border border-[#333] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                        />
                        <select
                          value={imageRoleInput}
                          onChange={(e) => setImageRoleInput(e.target.value as any)}
                          className="bg-[#111] border border-[#333] px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
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
                          className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#B3932F] text-[#0A0A0A] text-xs font-bold uppercase"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Media Grid */}
                    {images.filter(img => img.colourName === selectedColourName).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {images.filter(img => img.colourName === selectedColourName).map((img, idx) => (
                          <div key={img.id} className={\`group relative aspect-[3/4] bg-[#0A0A0A] border \${img.isPrimary ? 'border-[#D4AF37]' : 'border-[#262626]'} overflow-hidden\`}>
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


\n`;

const newContent = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync('components/product-form.tsx', newContent);
console.log('Sections replaced successfully.');
