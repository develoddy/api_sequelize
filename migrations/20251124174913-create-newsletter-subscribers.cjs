'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('newsletter_subscribers', {
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
        type: Sequelize.ENUM('home', 'footer', 'checkout', 'campaign_import', 'admin'),
        defaultValue: 'home',
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
      notified_campaign: {
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

    // Add indexes
    await queryInterface.addIndex('newsletter_subscribers', ['status'], {
      name: 'idx_newsletter_status'
    });
    
    await queryInterface.addIndex('newsletter_subscribers', ['source'], {
      name: 'idx_newsletter_source'
    });
    
    await queryInterface.addIndex('newsletter_subscribers', ['createdAt'], {
      name: 'idx_newsletter_created_at'
    });

    await queryInterface.addIndex('newsletter_subscribers', ['email_verified'], {
      name: 'idx_newsletter_email_verified'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('newsletter_subscribers');
  }
};
