import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join('node_modules', '@shopify', 'polaris-types', 'dist', 'custom-elements.json');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Find all elements/tags in custom-elements.json
  const tags: string[] = [];
  if (data.modules) {
    for (const mod of data.modules) {
      if (mod.declarations) {
        for (const dec of mod.declarations) {
          if (dec.tagName) {
            tags.push(dec.tagName);
          }
        }
      }
    }
  }
  
  console.log("Found Web Component tags:");
  console.log(JSON.stringify(tags.sort(), null, 2));
} else {
  console.log("File not found:", filePath);
}
