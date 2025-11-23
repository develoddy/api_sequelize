import { sequelize } from '../src/database/database.js';

async function fixMigrations() {
    try {
        console.log('\n=== VERIFICANDO MIGRACIONES ===\n');

        // Ver qué migraciones están registradas
        const [executed] = await sequelize.query('SELECT name FROM SequelizeMeta ORDER BY name;');
        console.log('✅ Migraciones ejecutadas:');
        executed.forEach(m => console.log(`  - ${m.name}`));

        // Verificar si birthday existe en guests
        const [birthdayExists] = await sequelize.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'ecommercedb' AND TABLE_NAME = 'guests' AND COLUMN_NAME = 'birthday';"
        );

        if (birthdayExists.length > 0) {
            console.log('\n✅ Campo birthday ya existe en guests');
            // Marcar migración como ejecutada si no está
            const hasMigration = executed.find(m => m.name === '20251114164428-add_birthday_to_guest.cjs');
            if (!hasMigration) {
                console.log('📝 Marcando migración 20251114164428-add_birthday_to_guest.cjs como ejecutada...');
                await sequelize.query("INSERT INTO SequelizeMeta (name) VALUES ('20251114164428-add_birthday_to_guest.cjs');");
            }
        }

        // Verificar si avatar existe en guests
        const [avatarExists] = await sequelize.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'ecommercedb' AND TABLE_NAME = 'guests' AND COLUMN_NAME = 'avatar';"
        );

        if (avatarExists.length > 0) {
            console.log('✅ Campo avatar ya existe en guests');
            const hasMigration = executed.find(m => m.name === '20251114221255-add_avatar_to_guest.cjs');
            if (!hasMigration) {
                console.log('📝 Marcando migración 20251114221255-add_avatar_to_guest.cjs como ejecutada...');
                await sequelize.query("INSERT INTO SequelizeMeta (name) VALUES ('20251114221255-add_avatar_to_guest.cjs');");
            }
        }

        // Verificar si prelaunch_subscribers existe
        const [tableExists] = await sequelize.query(
            "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'ecommercedb' AND TABLE_NAME = 'prelaunch_subscribers';"
        );

        if (tableExists.length > 0) {
            console.log('✅ Tabla prelaunch_subscribers ya existe');
            const hasMigration = executed.find(m => m.name === '20251122000000-create-prelaunch-subscribers.cjs');
            if (!hasMigration) {
                console.log('📝 Marcando migración 20251122000000-create-prelaunch-subscribers.cjs como ejecutada...');
                await sequelize.query("INSERT INTO SequelizeMeta (name) VALUES ('20251122000000-create-prelaunch-subscribers.cjs');");
            }
        }

        console.log('\n✅ Migraciones sincronizadas correctamente\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

fixMigrations();
