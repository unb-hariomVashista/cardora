import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join('node_modules', '@shopify', 'polaris-types', 'dist', 'custom-elements.json');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  const targetComponents = [
    's-box',
    's-badge',
    's-banner',
    's-button',
    's-select',
    's-search-field',
    's-text-field',
    's-table',
    's-modal'
  ];
  
  console.log("Analyzing component details:");
  if (data.modules) {
    for (const mod of data.modules) {
      if (mod.declarations) {
        for (const dec of mod.declarations) {
          if (dec.tagName && targetComponents.includes(dec.tagName)) {
            console.log(`\n=================== ${dec.tagName.toUpperCase()} ===================`);
            console.log("Description:", dec.description || "No description");
            
            if (dec.members) {
              const props = dec.members
                .filter((m: any) => m.kind === 'field' && m.privacy !== 'private')
                .map((m: any) => `${m.name} (${m.type?.text || 'any'}): ${m.description || ''}`);
              if (props.length > 0) {
                console.log("\nProperties:");
                props.forEach((p: string) => console.log(`  - ${p}`));
              }
            }
            
            if (dec.slots) {
              console.log("\nSlots:");
              dec.slots.forEach((s: any) => console.log(`  - ${s.name}: ${s.description || ''}`));
            }
          }
        }
      }
    }
  }
} else {
  console.log("File not found:", filePath);
}
