'use strict';

/**
 * Migration: Create Assets and Liabilities tables for Net Worth tracking
 * Tablas para gestión de patrimonio neto (activos y pasivos)
 * 
 * @author GitHub Copilot
 * @date 2026-03-05
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('💰 Creando tablas para sistema de patrimonio neto...');
    
    // Verificar si las tablas ya existen
    const tables = await queryInterface.showAllTables();
    
    // ============================================
    // CREAR TABLA ASSETS
    // ============================================
    if (!tables.includes('assets')) {
      await queryInterface.createTable('assets', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: 'Nombre del activo'
        },
        type: {
          type: Sequelize.ENUM('cash', 'property', 'investment', 'vehicle', 'other'),
          allowNull: false,
          defaultValue: 'other',
          comment: 'Tipo de activo'
        },
        current_value: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0.00,
          comment: 'Valor actual del activo'
        },
        bank_account_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'bank_accounts',
            key: 'id'
          },
          onDelete: 'SET NULL',
          comment: 'Vincula con bank_accounts para activos tipo cash'
        },
        purchase_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
          comment: 'Fecha de adquisición'
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Notas adicionales'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Indica si el activo está activo'
        },
        last_updated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      // Crear índices para assets
      await queryInterface.addIndex('assets', ['user_id', 'type'], {
        name: 'idx_user_type'
      });
      await queryInterface.addIndex('assets', ['user_id', 'is_active'], {
        name: 'idx_user_active'
      });

      console.log('   ✅ Tabla assets creada con índices');
    } else {
      console.log('   ⏭️  Tabla assets ya existe, saltando...');
    }

    // ============================================
    // CREAR TABLA LIABILITIES
    // ============================================
    if (!tables.includes('liabilities')) {
      await queryInterface.createTable('liabilities', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: 'Nombre del pasivo'
        },
        type: {
          type: Sequelize.ENUM('credit_card', 'loan', 'mortgage', 'debt', 'other'),
          allowNull: false,
          defaultValue: 'debt',
          comment: 'Tipo de pasivo'
        },
        total_amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          comment: 'Monto original de la deuda'
        },
        remaining_amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          comment: 'Saldo actual pendiente'
        },
        monthly_payment: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
          comment: 'Pago mensual'
        },
        interest_rate: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: true,
          comment: 'Tasa de interés anual en porcentaje'
        },
        start_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
          comment: 'Fecha de inicio de la deuda'
        },
        due_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
          comment: 'Fecha de vencimiento final'
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Notas adicionales'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Indica si el pasivo está activo'
        },
        last_updated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      // Crear índices para liabilities
      await queryInterface.addIndex('liabilities', ['user_id', 'type'], {
        name: 'idx_liab_user_type'
      });
      await queryInterface.addIndex('liabilities', ['user_id', 'is_active'], {
        name: 'idx_liab_user_active'
      });
      await queryInterface.addIndex('liabilities', ['user_id', 'remaining_amount'], {
        name: 'idx_liab_user_remaining'
      });

      console.log('   ✅ Tabla liabilities creada con índices');
    } else {
      console.log('   ⏭️  Tabla liabilities ya existe, saltando...');
    }

    // ============================================
    // MIGRAR DATOS: debts → liabilities
    // ============================================
    console.log('💾 Migrando datos de debts a liabilities...');
    
    const debtsTableExists = tables.includes('debts');
    
    if (debtsTableExists) {
      const debts = await queryInterface.sequelize.query(
        'SELECT * FROM debts',
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (debts && debts.length > 0) {
        console.log(`   📦 Encontradas ${debts.length} deudas para migrar`);
        
        for (const debt of debts) {
          // Verificar si ya existe la migración (usar creditor en lugar de name)
          const [existing] = await queryInterface.sequelize.query(
            'SELECT id FROM liabilities WHERE user_id = ? AND name = ? AND total_amount = ?',
            {
              replacements: [
                debt.user_id, 
                debt.creditor || 'Deuda migrada', 
                debt.original_amount || 0
              ],
              type: Sequelize.QueryTypes.SELECT
            }
          );

          if (!existing) {
            // Mapear campos de debts a liabilities
            const name = debt.creditor || 'Deuda migrada';
            const totalAmount = debt.original_amount || 0;
            const remainingAmount = debt.remaining_balance || 0;
            const monthlyPayment = debt.monthly_payment || null;
            const interestRate = debt.interest_rate || null;
            const startDate = debt.start_date || new Date().toISOString().split('T')[0];
            const notes = `Migrado desde tabla debts (ID: ${debt.id}, Tipo: ${debt.debt_type || 'N/A'})`;
            const createdAt = debt.createdAt || debt.created_at || new Date().toISOString().split('T')[0];

            await queryInterface.sequelize.query(
              `INSERT INTO liabilities (
                user_id, name, type, total_amount, remaining_amount, 
                monthly_payment, interest_rate, start_date, notes, created_at
              ) VALUES (?, ?, 'debt', ?, ?, ?, ?, ?, ?, ?)`,
              {
                replacements: [
                  debt.user_id,
                  name,
                  totalAmount,
                  remainingAmount,
                  monthlyPayment,
                  interestRate,
                  startDate,
                  notes,
                  createdAt
                ]
              }
            );
          }
        }
        console.log(`   ✅ ${debts.length} deudas migradas exitosamente`);
      } else {
        console.log('   ℹ️  No hay deudas para migrar');
      }
    } else {
      console.log('   ⏭️  Tabla debts no existe, saltando migración de datos');
    }

    // ============================================
    // TABLA OPCIONAL: net_worth_snapshots
    // ============================================
    if (!tables.includes('net_worth_snapshots')) {
      await queryInterface.createTable('net_worth_snapshots', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        snapshot_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          comment: 'Fecha del snapshot'
        },
        total_assets: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0.00
        },
        total_liabilities: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0.00
        },
        net_worth: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0.00
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      // Crear índices para snapshots
      await queryInterface.addIndex('net_worth_snapshots', ['user_id', 'snapshot_date'], {
        name: 'idx_snapshot_user_date',
        unique: true
      });

      console.log('   ✅ Tabla net_worth_snapshots creada (opcional para fase 5)');
    } else {
      console.log('   ⏭️  Tabla net_worth_snapshots ya existe');
    }

    console.log('🎉 Migración de patrimonio neto completada exitosamente!');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Revirtiendo tablas de patrimonio neto...');
    
    await queryInterface.dropTable('net_worth_snapshots');
    console.log('   ✅ net_worth_snapshots eliminada');
    
    await queryInterface.dropTable('liabilities');
    console.log('   ✅ liabilities eliminada');
    
    await queryInterface.dropTable('assets');
    console.log('   ✅ assets eliminada');
    
    console.log('✅ Reversión completada');
  }
};
