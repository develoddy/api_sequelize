import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { User } from './User.js';
import { Guest } from './Guest.js';
import { Sale } from './Sale.js';

/**
 * =====================================================================================
 * MODELO: Receipt (Recibo de Pago)
 * 
 * Este modelo representa los recibos de pago de las ventas.
 * 
 * Hook afterUpdate:
 * - Detecta cuando el status cambia a 'pagado'
 * - Inicia automáticamente la sincronización con Printful
 * - Registra el evento en logs para auditoría
 * 
 * Estados de Receipt:
 * - pendiente: Pago no confirmado
 * - pagado: Pago confirmado → TRIGGER auto-sync
 * - cancelado: Pago cancelado
 * =====================================================================================
 */

export const Receipt = sequelize.define('receipts', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    // Relación opcional con usuario registrado
    userId: { 
        type: DataTypes.INTEGER, 
        allowNull: true,
        references: { model: User, key: 'id' }
    },

    // Relación opcional con invitado
    guestId: { 
        type: DataTypes.INTEGER, 
        allowNull: true,
        references: { model: Guest, key: 'id' }
    },

    // Relación opcional con venta (simulación)
    saleId: { 
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: Sale, key: 'id' }
    },

    amount: { type: DataTypes.FLOAT, allowNull: false },
    paymentMethod: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'efectivo' },
    paymentDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente' },
    notes: { type: DataTypes.STRING(250), allowNull: true },
    zipcode: { type: DataTypes.STRING(250), allowNull: false },
}, {
    timestamps: true,
    tableName: 'receipts'
});

// 🔹 Relaciones inversas (para eager loading)
User.hasMany(Receipt, { foreignKey: 'userId' });
Guest.hasMany(Receipt, { foreignKey: 'guestId' });
Sale.hasMany(Receipt, { foreignKey: 'saleId' });
Receipt.belongsTo(User, { foreignKey: 'userId' });
Receipt.belongsTo(Guest, { foreignKey: 'guestId' });
Receipt.belongsTo(Sale, { foreignKey: 'saleId' });

// ========== HOOK: Auto-Sync cuando status = 'paid' o 'pagado' ========== //
Receipt.afterUpdate(async (receipt, options) => {
  try {
    // Solo ejecutar si el status cambió a 'paid' (Stripe) o 'pagado' (español)
    const statusChanged = receipt.changed('status');
    const validPaidStatuses = ['paid', 'pagado'];
    const isPaid = validPaidStatuses.includes(receipt.status);
    
    if (!statusChanged || !isPaid) {
      return; // No hacer nada si no cambió a estado pagado
    }

    // Validar que exista saleId
    if (!receipt.saleId) {
      console.warn(`⚠️ [RECEIPT HOOK] Receipt ${receipt.id} pagado pero sin saleId asociado`);
      return;
    }

    console.log(`\n🔔 [RECEIPT HOOK] ¡Pago confirmado! Receipt ID: ${receipt.id}, Sale ID: ${receipt.saleId}`);
    console.log(`💰 Amount: €${receipt.amount}, Method: ${receipt.paymentMethod}`);
    console.log(`🚀 Iniciando auto-sync con Printful...`);

    // Importar dinámicamente para evitar dependencias circulares
    const { autoSyncOrderToPrintful } = await import('../services/autoSyncPrintful.service.js');
    
    // Ejecutar sincronización asíncrona (no bloquear el update de Receipt)
    autoSyncOrderToPrintful(receipt.saleId)
      .then(result => {
        if (result.success) {
          console.log(`✅ [RECEIPT HOOK] Auto-sync exitoso para Sale ${receipt.saleId}`);
          console.log(`   📋 Printful Order ID: ${result.printfulOrderId}`);
        } else {
          console.error(`❌ [RECEIPT HOOK] Auto-sync falló para Sale ${receipt.saleId}:`, result.message);
        }
      })
      .catch(error => {
        console.error(`❌ [RECEIPT HOOK] Error en auto-sync para Sale ${receipt.saleId}:`, error.message);
      });

  } catch (error) {
    console.error('❌ [RECEIPT HOOK] Error en afterUpdate:', error);
    // No lanzar el error para no afectar el update de Receipt
  }
});

//uando seas autónomo y emitas facturas, solo necesitas agregar:
//Receipt.belongsTo(Invoice, { foreignKey: 'invoiceId' });
//Invoice.hasMany(Receipt, { foreignKey: 'invoiceId' });

export default Receipt;
