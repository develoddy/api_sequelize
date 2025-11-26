import { sequelize } from './src/database/database.js';
import { PostalCode } from './src/models/PostalCode.js';

function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

(async () => {
  try {
    console.log('🔄 Iniciando actualización...\n');

    const allRecords = await PostalCode.findAll({
      attributes: ['id', 'city', 'city_normalized'],
      raw: true
    });

    console.log(`📊 Total: ${allRecords.length}\n`);

    let updated = 0;

    for (const record of allRecords) {
      const correctNormalized = normalizeString(record.city);
      
      if (record.city_normalized !== correctNormalized) {
        await PostalCode.update(
          { city_normalized: correctNormalized },
          { where: { id: record.id } }
        );
        updated++;
        
        if (updated <= 3) {
          console.log(`✅ ID ${record.id}: "${record.city}"`);
          console.log(`   Anterior: "${record.city_normalized}"`);
          console.log(`   Nuevo: "${correctNormalized}"\n`);
        }
      }
    }

    console.log(`\n📈 Actualizados: ${updated}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await sequelize.close();
    process.exit(1);
  }
})();
