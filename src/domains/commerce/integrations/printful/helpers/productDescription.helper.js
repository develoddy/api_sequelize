// helpers/productDescription.helper.js
import fs from 'fs';
import path from 'path';

const jsonPath = new URL('./data/productDescriptions.json', import.meta.url);
const rawData = fs.readFileSync(jsonPath);
const descriptions = JSON.parse(rawData);

export function generarDescripcionPorCategoria(title, lang = 'es') {
  if (!title) return descriptions['shirt'][lang]; // fallback genérico

  const categoria = title.toLowerCase();

  if (categoria.includes("shirt")) return descriptions['shirt'][lang];
  if (categoria.includes("hoodie")) return descriptions['hoodie'][lang];
  if (categoria.includes("mug")) return descriptions['mug'][lang];
  if (categoria.includes("hat") || categoria.includes("cap")) return descriptions['hat'][lang];

  return descriptions['shirt'][lang]; // fallback
}
