'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla mailflow_sequences
    await queryInterface.createTable('mailflow_sequences', {
      sequenceId: {
        type: Sequelize.STRING(50),
        primaryKey: true,
        allowNull: false
      },
      tenantId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del tenant SaaS (si aplica)'
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del usuario propietario'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Nombre de la secuencia'
      },
      businessType: {
        type: Sequelize.ENUM('ecommerce', 'saas', 'services', 'education', 'other'),
        allowNull: false,
        comment: 'Tipo de negocio'
      },
      goal: {
        type: Sequelize.ENUM('first-purchase', 'trial-conversion', 'engagement', 'onboarding'),
        allowNull: false,
        comment: 'Objetivo de la secuencia'
      },
      brandName: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Nombre de la marca'
      },
      emailTone: {
        type: Sequelize.ENUM('friendly', 'professional', 'casual'),
        defaultValue: 'friendly',
        comment: 'Tono de comunicación'
      },
      emails: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Array de emails de la secuencia'
      },
      estimatedContacts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Número estimado de contactos'
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'paused', 'completed'),
        defaultValue: 'draft',
        comment: 'Estado de la secuencia'
      },
      activatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de activación'
      },
      pausedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de pausa'
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de finalización'
      },
      stats: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Estadísticas de la secuencia'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Agregar índices a mailflow_sequences
    await queryInterface.addIndex('mailflow_sequences', ['tenantId'], {
      name: 'idx_mailflow_sequences_tenant'
    });
    
    await queryInterface.addIndex('mailflow_sequences', ['userId'], {
      name: 'idx_mailflow_sequences_user'
    });
    
    await queryInterface.addIndex('mailflow_sequences', ['status'], {
      name: 'idx_mailflow_sequences_status'
    });
    
    await queryInterface.addIndex('mailflow_sequences', ['createdAt'], {
      name: 'idx_mailflow_sequences_created'
    });

    // Crear tabla mailflow_contacts
    await queryInterface.createTable('mailflow_contacts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      sequenceId: {
        type: Sequelize.STRING(50),
        allowNull: false,
        references: {
          model: 'mailflow_sequences',
          key: 'sequenceId'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'completed', 'failed', 'unsubscribed'),
        defaultValue: 'pending',
        comment: 'Estado del contacto en la secuencia'
      },
      currentEmailIndex: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Índice del próximo email a enviar (0-based)'
      },
      lastEmailSentAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha del último email enviado'
      },
      nextEmailAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha programada del próximo email'
      },
      stats: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Estadísticas del contacto'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Datos adicionales del contacto'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Agregar índices a mailflow_contacts
    await queryInterface.addIndex('mailflow_contacts', ['sequenceId'], {
      name: 'idx_mailflow_contacts_sequence'
    });
    
    await queryInterface.addIndex('mailflow_contacts', ['email'], {
      name: 'idx_mailflow_contacts_email'
    });
    
    await queryInterface.addIndex('mailflow_contacts', ['status'], {
      name: 'idx_mailflow_contacts_status'
    });
    
    await queryInterface.addIndex('mailflow_contacts', ['nextEmailAt'], {
      name: 'idx_mailflow_contacts_next_email'
    });
    
    await queryInterface.addIndex('mailflow_contacts', ['sequenceId', 'email'], {
      unique: true,
      name: 'unique_mailflow_sequence_email'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('mailflow_contacts');
    await queryInterface.dropTable('mailflow_sequences');
  }
};
