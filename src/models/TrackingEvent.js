/**
 * TrackingEvent Model
 * 
 * Almacena eventos de tracking del frontend para análisis de métricas.
 * Permite medir el funnel completo desde preview hasta activación.
 * 
 * @module models/TrackingEvent
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const TrackingEvent = sequelize.define('TrackingEvent', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // Datos del evento
    event: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre del evento (wizard_step_completed, preview_generated, etc.)'
    },
    
    properties: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON con propiedades adicionales del evento'
    },
    
    // Identificación
    session_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID de sesión anónima (sessionStorage)'
    },
    
    user_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID del usuario si está autenticado'
    },
    
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID del tenant si está autenticado'
    },
    
    // Contexto
    module: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Módulo asociado (mailflow, etc.)'
    },
    
    source: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Origen del evento (preview, onboarding, dashboard)'
    },
    
    // Metadata técnica
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent del navegador'
    },
    
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP del usuario'
    },
    
    // Timestamps
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp del evento'
    },
    
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'tracking_events',
    timestamps: false,
    indexes: [
      {
        fields: ['event']
      },
      {
        fields: ['session_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['tenant_id']
      },
      {
        fields: ['module']
      },
      {
        fields: ['timestamp']
      }
    ]
  });

export default TrackingEvent;
