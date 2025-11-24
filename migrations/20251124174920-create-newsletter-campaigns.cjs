'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('newsletter_campaigns', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(250),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      html_body: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      filters: {
        type: Sequelize.JSON,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'scheduled', 'sending', 'completed', 'failed'),
        defaultValue: 'draft',
        allowNull: false
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      total_recipients: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      sent_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      delivered_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      failed_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      opened_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      clicked_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      test_emails: {
        type: Sequelize.JSON,
        allowNull: true
      },
      error_log: {
        type: Sequelize.TEXT,
        allowNull: true
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

    // Add indexes
    await queryInterface.addIndex('newsletter_campaigns', ['status'], {
      name: 'idx_campaign_status'
    });
    
    await queryInterface.addIndex('newsletter_campaigns', ['createdAt'], {
      name: 'idx_campaign_created_at'
    });

    await queryInterface.addIndex('newsletter_campaigns', ['created_by'], {
      name: 'idx_campaign_created_by'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('newsletter_campaigns');
  }
};
