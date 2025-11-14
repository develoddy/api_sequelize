import axios from "axios";
import fs from 'fs';
import path from "path";
import sharp from "sharp"; 


export const generateSlug = async(name) => {
    return name.toLowerCase().replace(/ /g,'-').replace(/[^\w-]+/g,'');
}

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