'use strict';

/**
 * MIGRACIÓN: Tabla video_jobs
 * 
 * Propósito: Almacenar trabajos de generación de videos para Product Video Express
 * 
 * Campos clave:
 * - status: pending → processing → completed / failed
 * - fal_request_id: identificador único del job en fal.ai
 * - animation_style: zoom_in | parallax | subtle_float
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Verificar si la tabla ya existe
      const tableExists = await queryInterface.tableExists('video_jobs');
      if (tableExists) {
        console.log('⚠️  Tabla video_jobs ya existe, saltando creación...');
        return;
      }

      console.log('✨ Creando tabla video_jobs...');

      await queryInterface.createTable('video_jobs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        
        // Relación con usuario admin
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: 'ID del usuario admin que creó el job'
        },

        // INPUT: Imagen original
        product_image_url: {
          type: Sequelize.STRING(500),
          allowNull: false,
          comment: 'Ruta local o S3 de la imagen del producto'
        },

        product_image_filename: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: 'Nombre original del archivo subido'
        },

        // Estilo de animación seleccionado
        animation_style: {
          type: Sequelize.ENUM('zoom_in', 'parallax', 'subtle_float'),
          allowNull: false,
          defaultValue: 'parallax',
          comment: 'Tipo de animación cinematográfica'
        },

        // TRACKING: Estado del job
        status: {
          type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'Estado actual del trabajo'
        },

        // Integración con fal.ai
        fal_request_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          unique: true,
          comment: 'ID del request en fal.ai para polling'
        },

        // OUTPUT: Video generado
        output_video_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'URL del video final (local o S3)'
        },

        output_video_filename: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'Nombre del archivo de video generado'
        },

        duration_seconds: {
          type: Sequelize.FLOAT,
          allowNull: true,
          comment: 'Duración del video en segundos'
        },

        // Metadatos de error
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Mensaje de error si el job falla'
        },

        error_code: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Código de error para debug (ej: FAL_TIMEOUT, INVALID_IMAGE)'
        },

        // Métricas de rendimiento
        processing_time_ms: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Tiempo total de procesamiento en milisegundos'
        },

        fal_processing_time_ms: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Tiempo reportado por fal.ai'
        },

        // Timestamps de auditoría
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },

        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        },

        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp cuando el job terminó (success o fail)'
        }
      }, {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        comment: 'Jobs de generación de videos con IA para Product Video Express'
      });

      // Índices para optimizar queries
      await queryInterface.addIndex('video_jobs', ['user_id'], {
        name: 'idx_video_jobs_user_id'
      });

      await queryInterface.addIndex('video_jobs', ['status'], {
        name: 'idx_video_jobs_status'
      });

      await queryInterface.addIndex('video_jobs', ['fal_request_id'], {
        name: 'idx_video_jobs_fal_request_id',
        unique: true
      });

      await queryInterface.addIndex('video_jobs', ['created_at'], {
        name: 'idx_video_jobs_created_at'
      });

      console.log('✅ Tabla video_jobs creada exitosamente');

    } catch (error) {
      console.error('❌ Error al crear tabla video_jobs:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('🗑️  Eliminando tabla video_jobs...');
      await queryInterface.dropTable('video_jobs');
      console.log('✅ Tabla video_jobs eliminada');
    } catch (error) {
      console.error('❌ Error al eliminar tabla video_jobs:', error);
      throw error;
    }
  }
};
