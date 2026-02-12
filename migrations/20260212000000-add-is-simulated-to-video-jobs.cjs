/**
 * Migración: Añadir campo is_simulated a video_jobs
 * 
 * Fecha: 2026-02-12
 * 
 * Propósito: Sistema de protección de créditos
 * Permite identificar videos generados con placeholder (simulación o límite alcanzado)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('video_jobs', 'is_simulated', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'true si es video placeholder (SIMULATION_MODE o límite alcanzado)',
      after: 'completed_at' // Posición en la tabla
    });

    console.log('✅ Campo is_simulated añadido a video_jobs');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('video_jobs', 'is_simulated');
    console.log('✅ Campo is_simulated eliminado de video_jobs');
  }
};
