/**
 * Migration: Add preview_config to modules table
 * 
 * Esta migración agrega el sistema genérico de Preview Mode a cualquier módulo SaaS.
 * Permite configurar previews públicos sin login para validación temprana.
 * 
 * Estructura preview_config:
 * {
 *   enabled: boolean,              // ¿Activar preview público?
 *   route: string,                 // Ruta pública (ej: '/preview/mailflow')
 *   public_endpoint: string,       // Endpoint backend (ej: '/api/mailflow/preview/generate')
 *   show_in_store: boolean,        // ¿Mostrar botón "Try Demo" en tienda?
 *   demo_button_text: string,      // Texto del botón (ej: "Try Demo - No signup required")
 *   generator_function: string,    // Nombre de la función generadora (ej: 'generateMailflowPreview')
 *   conversion_config: {           // Configuración de conversión post-registro
 *     recovery_key: string,        // Clave sessionStorage (ej: 'mailflow_preview')
 *     redirect_route: string,      // Ruta después de login (ej: '/mailflow/onboarding')
 *     auto_activate: boolean       // ¿Activar automáticamente después de registro?
 *   },
 *   rate_limiting: {               // Configuración de rate limiting
 *     max_requests: number,        // Máximo requests por ventana
 *     window_minutes: number       // Ventana de tiempo en minutos
 *   }
 * }
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🚀 Agregando preview_config a tabla modules...');
      
      // Verificar si la columna ya existe
      const tableDescription = await queryInterface.describeTable('modules');
      
      if (!tableDescription.preview_config) {
        // Agregar columna preview_config solo si no existe
        await queryInterface.addColumn(
          'modules',
          'preview_config',
          {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null,
            comment: 'Configuración del modo preview público para validación sin login'
          },
          { transaction }
        );
        console.log('✅ Columna preview_config agregada correctamente');
      } else {
        console.log('ℹ️  Columna preview_config ya existe, saltando...');
      }
      
      console.log('✅ Columna preview_config agregada');
      
      // MariaDB no soporta índices funcionales en JSON
      // Omitimos la creación del índice (no es crítico para funcionalidad)
      console.log('ℹ️  Índice JSON omitido (no compatible con MariaDB)');
      
      await transaction.commit();
      console.log('✅ Migración completada: Preview Mode genérico disponible');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Revirtiendo preview_config...');
      
      // Eliminar columna (no hay índice que eliminar)
      await queryInterface.removeColumn('modules', 'preview_config', { transaction });
      
      await transaction.commit();
      console.log('✅ Revert completado');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en revert:', error);
      throw error;
    }
  }
};
