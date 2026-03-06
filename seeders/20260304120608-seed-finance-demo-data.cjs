'use strict';

/**
 * Seeder: Finance Module Demo Data
 * 
 * Crea datos de demostración para el módulo de finanzas:
 * - 1 cuenta bancaria (Banco Santander)
 * - 2 ingresos (salario mensual + ingreso adicional)
 * - 3 gastos (alquiler, supermercado, ocio)
 * - 1 deuda (tarjeta de crédito)
 * 
 * Resultado esperado en dashboard:
 * - Balance del mes: 3,450 EUR
 * - DTI: 6% (verde)
 * - Debt Burden: 0.5 meses
 * - Savings Rate: 66.5%
 * - Estado: VERDE (Saludable)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // 1️⃣ Obtener el primer usuario (admin) para asociar los datos
    const [users] = await queryInterface.sequelize.query(
      'SELECT id FROM users ORDER BY id ASC LIMIT 1'
    );

    if (!users || users.length === 0) {
      console.log('❌ No se encontró ningún usuario. Crea un usuario primero.');
      return;
    }

    const userId = users[0].id;
    console.log(`✅ Usuario encontrado: ID ${userId}`);

    // Verificar si ya existen datos financieros para este usuario
    const [existingAccounts] = await queryInterface.sequelize.query(
      'SELECT id FROM bank_accounts WHERE user_id = ? LIMIT 1',
      { replacements: [userId] }
    );

    if (existingAccounts && existingAccounts.length > 0) {
      console.log('⚠️  Ya existen datos financieros para este usuario. Saltando seeder.');
      return;
    }

    // 2️⃣ Crear cuenta bancaria
    await queryInterface.bulkInsert('bank_accounts', [
      {
        user_id: userId,
        name: 'Cuenta Corriente Principal',
        bank_name: 'Banco Santander',
        account_type: 'checking',
        balance: 5000.00,
        currency: 'EUR',
        is_active: true,
        notes: 'Cuenta principal para operaciones diarias',
        createdAt: now,
        updatedAt: now
      }
    ]);

    // Obtener el ID de la cuenta recién creada
    const [bankAccounts] = await queryInterface.sequelize.query(
      'SELECT id FROM bank_accounts WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      { replacements: [userId] }
    );
    const bankAccountId = bankAccounts[0].id;
    console.log(`✅ Cuenta bancaria creada: ID ${bankAccountId}`);

    // 3️⃣ Crear ingresos
    await queryInterface.bulkInsert('incomes', [
      {
        user_id: userId,
        bank_account_id: bankAccountId,
        category: 'salary',
        amount: 5000.00,
        currency: 'EUR',
        description: 'Salario mensual marzo 2026',
        date: '2026-03-01',
        is_recurring: true,
        recurrence_type: 'monthly',
        tags: 'salario,trabajo,principal',
        notes: 'Salario fijo mensual',
        createdAt: now,
        updatedAt: now
      },
      {
        user_id: userId,
        bank_account_id: bankAccountId,
        category: 'freelance',
        amount: 200.00,
        currency: 'EUR',
        description: 'Trabajo freelance extra',
        date: '2026-03-05',
        is_recurring: false,
        recurrence_type: 'none',
        tags: 'freelance,extra',
        notes: 'Proyecto puntual de diseño',
        createdAt: now,
        updatedAt: now
      }
    ]);
    console.log('✅ Ingresos creados: 2 registros');

    // 4️⃣ Crear gastos
    await queryInterface.bulkInsert('expenses', [
      {
        user_id: userId,
        bank_account_id: bankAccountId,
        category: 'housing',
        amount: 1200.00,
        currency: 'EUR',
        description: 'Alquiler marzo 2026',
        date: '2026-03-01',
        is_recurring: true,
        recurrence_type: 'monthly',
        is_essential: true,
        payment_method: 'bank_transfer',
        tags: 'alquiler,vivienda',
        notes: 'Alquiler apartamento centro',
        createdAt: now,
        updatedAt: now
      },
      {
        user_id: userId,
        bank_account_id: bankAccountId,
        category: 'groceries',
        amount: 350.00,
        currency: 'EUR',
        description: 'Compras supermercado',
        date: '2026-03-05',
        is_recurring: true,
        recurrence_type: 'monthly',
        is_essential: true,
        payment_method: 'debit_card',
        tags: 'comida,supermercado',
        notes: 'Mercado mensual',
        createdAt: now,
        updatedAt: now
      },
      {
        user_id: userId,
        bank_account_id: bankAccountId,
        category: 'entertainment',
        amount: 150.00,
        currency: 'EUR',
        description: 'Cine, restaurantes y ocio',
        date: '2026-03-10',
        is_recurring: false,
        recurrence_type: 'none',
        is_essential: false,
        payment_method: 'credit_card',
        tags: 'ocio,entretenimiento,no-esencial',
        notes: 'Gastos de entretenimiento del mes',
        createdAt: now,
        updatedAt: now
      }
    ]);
    console.log('✅ Gastos creados: 3 registros');

    // 5️⃣ Crear deuda
    await queryInterface.bulkInsert('debts', [
      {
        user_id: userId,
        bank_account_id: bankAccountId,
        creditor: 'Banco BBVA',
        debt_type: 'credit_card',
        original_amount: 3000.00,
        remaining_balance: 2500.00,
        currency: 'EUR',
        interest_rate: 18.50,
        monthly_payment: 300.00,
        start_date: '2024-01-01',
        due_date: '2024-12-31',
        payment_day: 5,
        status: 'active',
        priority: 'high',
        notes: 'Tarjeta de crédito con saldo pendiente. Se paga desde Cuenta Corriente Principal.',
        createdAt: now,
        updatedAt: now
      }
    ]);
    console.log('✅ Deuda creada: 1 registro (asociada a cuenta bancaria)');

    // 6️⃣ Resumen de métricas esperadas
    console.log('\n📊 RESUMEN DE DATOS CREADOS:');
    console.log('─────────────────────────────────────────');
    console.log('💰 Balance del mes:    3,150 EUR');
    console.log('   (Ingresos: 5,200 - Gastos: 1,700 - Deudas: 300)');
    console.log('');
    console.log('📈 Ingresos totales:   5,200 EUR');
    console.log('   - Salario: 5,000 EUR');
    console.log('   - Freelance: 200 EUR');
    console.log('');
    console.log('📉 Gastos totales:     1,700 EUR');
    console.log('   - Alquiler: 1,200 EUR (esencial)');
    console.log('   - Supermercado: 350 EUR (esencial)');
    console.log('   - Ocio: 150 EUR (no esencial)');
    console.log('');
    console.log('💳 Deuda:              2,500 EUR');
    console.log('   - Pago mensual: 300 EUR');
    console.log('   - DTI: 5.8% (300/5200 × 100)');
    console.log('   - Debt Burden: 0.48 meses (2500/5200)');
    console.log('   - Cuenta de pago: Cuenta Corriente Principal');
    console.log('');
    console.log('🎯 Métricas:');
    console.log('   - Tasa de ahorro: 60.6%');
    console.log('   - DTI: 5.8% (🟢 VERDE - Excelente)');
    console.log('   - Estado: VERDE (Saludable)');
    console.log('─────────────────────────────────────────');
    console.log('');
    console.log('✅ Seeder completado exitosamente');
    console.log('👉 Ve a /finance/dashboard para ver los resultados');
  },

  async down(queryInterface, Sequelize) {
    // Obtener el primer usuario
    const [users] = await queryInterface.sequelize.query(
      'SELECT id FROM users ORDER BY id ASC LIMIT 1'
    );

    if (!users || users.length === 0) {
      console.log('❌ No se encontró ningún usuario.');
      return;
    }

    const userId = users[0].id;

    // Eliminar datos en orden inverso (respetando foreign keys)
    await queryInterface.bulkDelete('debts', { user_id: userId }, {});
    await queryInterface.bulkDelete('expenses', { user_id: userId }, {});
    await queryInterface.bulkDelete('incomes', { user_id: userId }, {});
    await queryInterface.bulkDelete('bank_accounts', { user_id: userId }, {});

    console.log('✅ Datos financieros de demo eliminados');
  }
};
