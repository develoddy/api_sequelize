import fetch from 'node-fetch'; // solo si tu Node < 18, de lo contrario puedes omitirlo


export async function translateText(text, targetLang = 'es') {
  try {
    const res = await fetch("https://libretranslate.com/translate", {
      method: "POST",s
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: targetLang,
        format: "text"
      })
    });
    const data = await res.json();
    return data.translatedText;
  } catch (err) {
    console.error("Error en traducción:", err);
    return text;
  }
}