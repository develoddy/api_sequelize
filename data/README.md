# Códigos Postales - Dataset Completo

Este directorio contiene el dataset completo de códigos postales para validación de direcciones.

## 📦 Estructura del Archivo JSON

El seed espera un archivo llamado `postal-codes-es.json` con la siguiente estructura:

```json
[
  {
    "country": "ES",
    "postalCode": "28001",
    "province": "Madrid",
    "city": "Madrid",
    "isPrimary": true
  },
  {
    "country": "ES",
    "postalCode": "28013",
    "province": "Madrid",
    "city": "Madrid",
    "isPrimary": true
  },
  {
    "country": "ES",
    "postalCode": "28100",
    "province": "Madrid",
    "city": "Alcobendas",
    "isPrimary": true
  },
  ...
]
```

### Campos Obligatorios:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `country` | string | Código ISO del país (2 letras) | `"ES"`, `"FR"`, `"DE"` |
| `postalCode` | string | Código postal normalizado | `"28013"`, `"08001"` |
| `province` | string | Provincia/Estado/Región | `"Madrid"`, `"Barcelona"` |
| `city` | string | Ciudad/Población/Municipio | `"Madrid"`, `"Alcobendas"` |
| `isPrimary` | boolean | ¿Es la ciudad principal del CP? | `true`, `false` |

---

## 📥 Fuentes Oficiales de Datos

### España (ES)

1. **Correos de España** (Recomendado)
   - URL: https://www.correos.es/es/herramientas/codigos-postales
   - Formato: CSV, Excel
   - Cobertura: Todos los CPs de España (~52,000 registros)
   - Actualización: Oficial

2. **INE (Instituto Nacional de Estadística)**
   - URL: https://www.ine.es
   - Buscar: "Códigos postales por municipios"
   - Formato: CSV

3. **Datasets en GitHub**
   - Buscar: "spanish postal codes dataset json"
   - Ejemplo: https://github.com/IagoLast/posta-codes-spain
   - Verificar licencia y actualización

### Francia (FR)

- **La Poste**: https://datanova.laposte.fr/explore/dataset/laposte_hexasmal/
- Formato: CSV
- Cobertura: ~40,000 CPs

### Alemania (DE)

- **Deutsche Post**: https://www.deutschepost.de/de/p/plz.html
- Formato: CSV
- Cobertura: ~16,000 CPs

### Italia (IT)

- **Poste Italiane**: https://www.poste.it/cerca/index.html
- Formato: CSV
- Cobertura: ~18,000 CPs

### Portugal (PT)

- **CTT Correios**: https://www.ctt.pt/particulares/enviar/como-enviar/codigos-postais
- Formato: CSV
- Cobertura: ~12,000 CPs

---

## 🔧 Proceso de Conversión

Si descargas un CSV de Correos, conviértelo a JSON usando este script Node.js:

### `convert-csv-to-json.js`

```javascript
const fs = require('fs');
const csv = require('csv-parser');

const results = [];

fs.createReadStream('postal-codes-spain.csv')
  .pipe(csv({
    mapHeaders: ({ header }) => header.trim()
  }))
  .on('data', (row) => {
    results.push({
      country: 'ES',
      postalCode: row['Codigo Postal'] || row['CP'],
      province: row['Provincia'],
      city: row['Poblacion'] || row['Ciudad'] || row['Municipio'],
      isPrimary: row['Principal'] === 'Si' || row['Principal'] === 'true'
    });
  })
  .on('end', () => {
    fs.writeFileSync(
      'postal-codes-es.json',
      JSON.stringify(results, null, 2)
    );
    console.log(`✅ Convertidos ${results.length} registros a JSON`);
  });
```

**Instalar dependencia:**
```bash
npm install csv-parser
```

**Ejecutar:**
```bash
node convert-csv-to-json.js
```

---

## 📝 Pasos para Cargar el Dataset Completo

1. **Descargar el CSV oficial** de Correos.es o INE

2. **Convertir a JSON** usando el script de arriba

3. **Guardar** el archivo como `postal-codes-es.json` en este directorio (`/api/data/`)

4. **Revertir** la migración actual (elimina datos de ejemplo):
   ```bash
   cd /api
   npx sequelize-cli db:migrate:undo
   ```

5. **Re-ejecutar** la migración (detectará el JSON y lo cargará):
   ```bash
   npx sequelize-cli db:migrate
   ```

6. **Verificar** la carga:
   ```bash
   curl http://localhost:3000/api/postal-codes/stats
   ```
   
   Debería mostrar ~52,000 registros para España.

---

## 🧪 Testing con Datos de Ejemplo

Mientras no tengas el dataset completo, el sistema funciona con **~110 códigos postales de ejemplo** que incluyen:

- ✅ Madrid: 37 CPs (28001-28980)
- ✅ Barcelona: 20 CPs (08001-08901)
- ✅ Valencia: 10 CPs (46001-46010)
- ✅ Sevilla: 10 CPs (41001-41010)
- ✅ Zaragoza: 5 CPs (50001-50005)
- ✅ Málaga: 5 CPs (29001-29005)
- ✅ Bilbao: 5 CPs (48001-48005)

Estos datos son suficientes para:
- ✅ Probar el sistema tipo Mango.es
- ✅ Desarrollar el frontend
- ✅ Testing de integración
- ✅ Demos y presentaciones

---

## 📊 Estructura de la Tabla en Base de Datos

```sql
CREATE TABLE postal_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  country VARCHAR(2) NOT NULL,          -- ES, FR, DE, IT, PT
  postal_code VARCHAR(10) NOT NULL,     -- 28013, 08001, etc.
  province VARCHAR(100) NOT NULL,       -- Madrid, Barcelona
  city VARCHAR(100) NOT NULL,           -- Madrid, Alcobendas
  city_normalized VARCHAR(100) NOT NULL, -- madrid, alcobendas (para búsquedas)
  is_primary BOOLEAN DEFAULT FALSE,     -- ¿Ciudad principal del CP?
  is_active BOOLEAN DEFAULT TRUE,       -- ¿Registro activo?
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  INDEX idx_country_postal_code (country, postal_code),
  UNIQUE INDEX idx_country_postal_code_city (country, postal_code, city_normalized),
  INDEX idx_province (province),
  INDEX idx_city_normalized (city_normalized),
  INDEX idx_is_active (is_active)
);
```

---

## 🌍 Extensión a Otros Países

Para agregar otros países europeos, solo necesitas:

1. Descargar el dataset oficial del servicio de correos del país
2. Convertir a JSON con el mismo formato
3. Guardar como `postal-codes-{country}.json` (ej: `postal-codes-fr.json`)
4. Crear una nueva migración o modificar el seed existente

El sistema soporta cualquier país, solo requiere los datos en el formato correcto.

---

## ✅ Checklist de Implementación

- [x] Modelo PostalCode creado
- [x] Migración de tabla ejecutada
- [x] Seed con datos de ejemplo creado
- [ ] Dataset completo descargado
- [ ] Dataset convertido a JSON
- [ ] Archivo `postal-codes-es.json` colocado en `/api/data/`
- [ ] Migración re-ejecutada con datos completos
- [ ] Endpoints verificados con Postman

---

## 📞 Soporte

Si tienes problemas:
1. Verifica que el JSON tenga el formato exacto especificado arriba
2. Revisa los logs de la migración para ver errores
3. Consulta la documentación de Sequelize: https://sequelize.org

**Última actualización**: 25 de noviembre de 2025
