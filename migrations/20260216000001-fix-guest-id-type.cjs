'use strict';

/**
 * Migración: Cambiar guest_id de INTEGER a VARCHAR
 * 
 * El guest_id debe ser STRING porque el frontend genera identificadores
 * temporales como 'test_guest_1771246201326', no foreign keys a la tabla guests.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = async (tableName, transaction) => {
      try {
        await queryInterface.describeTable(tableName, { transaction });
        return true;
      } catch (error) {
        // Si la tabla no existe, describeTable lanza error - retornamos false
        return false;
      }
    };

    const columnExists = async (tableName, columnName, transaction) => {
      const definition = await queryInterface.describeTable(tableName, { transaction });
      return Boolean(definition[columnName]);
    };

    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      if (await tableExists('chat_conversations', transaction)) {
        if (await columnExists('chat_conversations', 'guest_id', transaction)) {
          // Cambiar guest_id de INTEGER a VARCHAR en chat_conversations
          await queryInterface.changeColumn('chat_conversations', 'guest_id', {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'ID temporal del invitado (generado por frontend)'
          }, { transaction });

          console.log('✅ Columna guest_id actualizada a VARCHAR(255)');
        } else {
          console.warn('⚠️ La columna guest_id no existe en chat_conversations. No hay cambios que aplicar.');
        }
      } else {
        console.warn('⚠️ La tabla chat_conversations no existe. Se omite fix-guest-id-type.');
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en migración fix-guest-id-type:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const tableExists = async (tableName, transaction) => {
      try {
        await queryInterface.describeTable(tableName, { transaction });
        return true;
      } catch (error) {
        // Si la tabla no existe, describeTable lanza error - retornamos false
        return false;
      }
    };

    const columnExists = async (tableName, columnName, transaction) => {
      const definition = await queryInterface.describeTable(tableName, { transaction });
      return Boolean(definition[columnName]);
    };

    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      if (await tableExists('chat_conversations', transaction)) {
        if (await columnExists('chat_conversations', 'guest_id', transaction)) {
          // Revertir a INTEGER (cuidado: puede fallar si hay datos string)
          await queryInterface.changeColumn('chat_conversations', 'guest_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'ID del invitado'
          }, { transaction });
        }
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error revirtiendo migración:', error);
      throw error;
    }
  }
};
