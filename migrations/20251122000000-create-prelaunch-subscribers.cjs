'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Verificar si la tabla ya existe
      const tableExists = await queryInterface.tableExists('prelaunch_subscribers');
      if (tableExists) {
        console.log('⚠️  Tabla prelaunch_subscribers ya existe, saltando creación...');
        return;
      }

      // Crear tabla
      await queryInterface.createTable('prelaunch_subscribers', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        email: {
          type: Sequelize.STRING(250),
          allowNull: false,
          unique: true
        },
        session_id: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        source: {
          type: Sequelize.ENUM('main_form', 'cta_final'),
          defaultValue: 'main_form',
          allowNull: false
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        referrer: {
          type: Sequelize.STRING(500),
          allowNull: true
        },
        utm_source: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        utm_medium: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        utm_campaign: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('subscribed', 'unsubscribed', 'bounced'),
          defaultValue: 'subscribed',
          allowNull: false
        },
        email_verified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        },
        verification_token: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        notified_launch: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        },
        coupon_sent: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });

      console.log('✅ Tabla prelaunch_subscribers creada exitosamente');

      // Crear índices adicionales (email ya es unique por definición de tabla)
      await queryInterface.addIndex('prelaunch_subscribers', ['status'], {
        name: 'idx_prelaunch_status'
      });
      
      await queryInterface.addIndex('prelaunch_subscribers', ['source'], {
        name: 'idx_prelaunch_source'
      });
      
      await queryInterface.addIndex('prelaunch_subscribers', ['createdAt'], {
        name: 'idx_prelaunch_created_at'
      });

      await queryInterface.addIndex('prelaunch_subscribers', ['session_id'], {
        name: 'idx_prelaunch_session_id'
      });

      console.log('✅ Índices creados exitosamente');

    } catch (error) {
      console.error('❌ Error en migración up:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Verificar si la tabla existe antes de eliminar
      const tableExists = await queryInterface.tableExists('prelaunch_subscribers');
      if (!tableExists) {
        console.log('⚠️  Tabla prelaunch_subscribers no existe, saltando eliminación...');
        return;
      }

      // Eliminar índices si existen
      const indexes = ['idx_prelaunch_status', 'idx_prelaunch_source', 'idx_prelaunch_created_at', 'idx_prelaunch_session_id'];
      
      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('prelaunch_subscribers', indexName);
        } catch (error) {
          console.log(`⚠️  Índice ${indexName} no encontrado o ya eliminado`);
        }
      }
      
      // Eliminar tabla
      await queryInterface.dropTable('prelaunch_subscribers');
      console.log('✅ Tabla prelaunch_subscribers eliminada exitosamente');

    } catch (error) {
      console.error('❌ Error en migración down:', error);
      throw error;
    }
  }
};