'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'order_notification_logs',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        saleId: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        eventType: {
          type: Sequelize.ENUM(
            'order_shipped',
            'order_delivered'
          ),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM(
            'pending',
            'sending',
            'sent',
            'failed',
            'uncertain'
          ),
          allowNull: false,
          defaultValue: 'pending'
        },
        attempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        smtpMessageId: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        sentAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false
        }
      },
      {
        indexes: [
          {
            name: 'uq_order_notification_event',
            unique: true,
            fields: ['saleId', 'eventType']
          }
        ]
      }
    );

    const indexes = await queryInterface.showIndex(
      'order_notification_logs'
    );

    if (!indexes.some(index =>
      index.name === 'uq_order_notification_event'
    )) {
      await queryInterface.addIndex(
        'order_notification_logs',
        ['saleId', 'eventType'],
        {
          name: 'uq_order_notification_event',
          unique: true
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      'order_notification_logs'
    );
  }
};
