'use strict';

/**
 * Migration: Add preview fields to video_jobs table
 * 
 * Añade campos necesarios para el sistema de preview
 * de video-express sin autenticación.
 * 
 * @author LujanDev
 * @date 2026-02-09
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Hacer user_id nullable (para preview jobs sin auth)
    await queryInterface.changeColumn('video_jobs', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'ID del usuario admin que creó el job (null para preview)'
    });
    
    // 2. Añadir flag de preview
    await queryInterface.addColumn('video_jobs', 'is_preview', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'status',
      comment: 'Flag para jobs de preview (sin auth)'
    });
    
    // 3. Añadir IP address (para rate limiting)
    await queryInterface.addColumn('video_jobs', 'ip_address', {
      type: Sequelize.STRING(45),
      allowNull: true,
      after: 'is_preview',
      comment: 'IP del usuario (para rate limiting en preview)'
    });
    
    // 4. Añadir objetivo de preview
    await queryInterface.addColumn('video_jobs', 'preview_objective', {
      type: Sequelize.ENUM('organic', 'ads'),
      allowNull: true,
      after: 'ip_address',
      comment: 'Objetivo seleccionado en preview'
    });
    
    // 5. Añadir feedback
    await queryInterface.addColumn('video_jobs', 'preview_feedback', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      after: 'preview_objective',
      comment: 'Feedback del usuario: ¿el video fue útil?'
    });
    
    // 6. Añadir timestamp de feedback
    await queryInterface.addColumn('video_jobs', 'preview_feedback_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'preview_feedback',
      comment: 'Cuándo se dio el feedback'
    });
    
    // 7. Crear índices para optimizar queries
    await queryInterface.addIndex('video_jobs', ['is_preview'], {
      name: 'idx_is_preview'
    });
    
    await queryInterface.addIndex('video_jobs', ['ip_address'], {
      name: 'idx_ip_address'
    });
    
    await queryInterface.addIndex('video_jobs', ['is_preview', 'created_at'], {
      name: 'idx_preview_created'
    });
    
    console.log('✅ Campos de preview añadidos a video_jobs exitosamente');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar índices
    await queryInterface.removeIndex('video_jobs', 'idx_is_preview');
    await queryInterface.removeIndex('video_jobs', 'idx_ip_address');
    await queryInterface.removeIndex('video_jobs', 'idx_preview_created');
    
    // Eliminar columnas
    await queryInterface.removeColumn('video_jobs', 'preview_feedback_at');
    await queryInterface.removeColumn('video_jobs', 'preview_feedback');
    await queryInterface.removeColumn('video_jobs', 'preview_objective');
    await queryInterface.removeColumn('video_jobs', 'ip_address');
    await queryInterface.removeColumn('video_jobs', 'is_preview');
    
    // Revertir user_id a NOT NULL
    await queryInterface.changeColumn('video_jobs', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: 'ID del usuario admin que creó el job'
    });
    
    console.log('✅ Campos de preview eliminados de video_jobs');
  }
};
