import axios from "axios";
import fs from 'fs';
import path from "path";
import sharp from "sharp"; 

export const convertWhiteToTransparent = async (imagePath) => {
  try {
    // Paths
    const tempImagePath = imagePath.replace('.jpeg', '_temp.png');
    const finalImagePath = imagePath.replace('.jpeg', '.png');

    // Load the image
    const image = sharp(imagePath);

    // Get image metadata
    const { width, height } = await image.metadata();

    // Create a new image with white replaced by transparent
    await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
            data[i + 3] = 0; // Set alpha to 0 for white pixels
          }
        }
        return sharp(data, { raw: info })
          .toFormat('png')
          .toFile(tempImagePath);
      });

    // Add background color and save as final image
    await sharp(tempImagePath)
      .composite([{ input: Buffer.from([204, 204, 204, 255]), raw: { width: 1, height: 1, channels: 4 }, tile: true }]) // Set background color #ccc
      .png()
      .toFile(finalImagePath);

    // Delete the temporary image file
    fs.unlinkSync(tempImagePath);

    // Remove the original jpeg file
    fs.unlinkSync(imagePath);

    console.log(`Image processed and saved as ${finalImagePath}`);
  } catch (error) {
    console.error('Error processing image:', error);
  }
};

export const downloadImage = async(imageUrl, localPath) => {
    const response = await axios.get(imageUrl, {
        responseType: 'stream'
    });

    // Crea un flujo de escritura para guardar el archivo localmente
    const writer = fs.createWriteStream(localPath);

    // Escribe el contenido del archivo
    response.data.pipe(writer);

    // Retorna una promesa que resuelve cuando se completa la escritura del archivo
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

export const generateImageName = async(url) => {
  const parts = url.split('/');
  const filename = parts[parts.length - 2] + '_preview.jpeg';
  return filename;
}

export const removeImageVersion = async(imagen) => {
    // Dividir la cadena utilizando "?v=" como separador y tomar el primer elemento
    const version = imagen.split("?v=");
    const image = version[0];
    return image;
}

export const extractSKU = async(str) => {
    const parts = str.split("_");
    return parts[0]; // Devuelve la primera parte como el SKU
}

export const generateSlug = async(name) => {
    return name.toLowerCase().replace(/ /g,'-').replace(/[^\w-]+/g,'');
}

export const removeRepeatedColors = async(array) => {
    return [...new Set(array)];
}

export const removeRepeatedGelatoColors = async( productVariantOptions ) => {
    const colors = productVariantOptions
        .filter(option => option.name === "Color")
        .flatMap(option => option.values); // Obtiene los valores de los colores

    return [...new Set(colors)]; // Elimina los colores repetidos y devuelve un array único
}

export const formatPrice = async(price) =>  {
  return Number(price.toFixed(2)); // Redondea el precio a dos decimales y lo convierte en una cadena
}

export const processGalleryImage = async (galleryImagePath) => {
  const galleryName = galleryImagePath.split('/').pop();
  const galleryUploadDir = path.resolve('./src/uploads/product');

  if (!fs.existsSync(galleryUploadDir)) {
    fs.mkdirSync(galleryUploadDir, { recursive: true });
  }

  const galleryImageFilePath = path.join(galleryUploadDir, galleryName);
  await downloadImage(galleryImagePath, galleryImageFilePath);

  return galleryName;
};

/**
 * 🆕 Procesa y descarga una imagen de galería con versionado
 * Añade un identificador único (hash o variant_id) para evitar colisiones
 * y permitir la detección de cambios en el contenido
 */
export const processGalleryImageVersioned = async (galleryImagePath, uniqueId, variantId) => {
  try {
    // Extraer extensión y nombre base
    const urlParts = galleryImagePath.split('/');
    const originalName = urlParts[urlParts.length - 1];
    const extension = originalName.split('.').pop();
    const baseName = originalName.replace(`.${extension}`, '').replace(/\?.*$/, ''); // Quitar query params
    
    // Crear nombre único: baseName-uniqueId-variantId.ext
    // Ejemplo: preview-abc123def456-12345.jpg
    const versionedName = `${baseName}-${uniqueId}-v${variantId}.${extension}`;
    
    const galleryUploadDir = path.resolve('./src/uploads/product');

    if (!fs.existsSync(galleryUploadDir)) {
      fs.mkdirSync(galleryUploadDir, { recursive: true });
    }

    const galleryImageFilePath = path.join(galleryUploadDir, versionedName);
    
    // Si el archivo ya existe con ese hash/versión, no descargarlo de nuevo
    if (fs.existsSync(galleryImageFilePath)) {
      console.log(`        ♻️ Imagen ya existe (usando caché): ${versionedName}`);
      return versionedName;
    }

    // Descargar nueva imagen
    await downloadImage(galleryImagePath, galleryImageFilePath);
    console.log(`        ⬇️ Imagen descargada: ${versionedName}`);

    return versionedName;
    
  } catch (error) {
    console.error(`        ❌ Error procesando imagen de galería:`, error.message);
    // Fallback al método antiguo sin versionado
    return await processGalleryImage(galleryImagePath);
  }
};