/**
 * RetryQueue Model
 * 
 * Maneja la cola de reintentos para órdenes fallidas con sistema de backoff exponencial.
 * Clasifica errores como temporal/recoverable/critical y gestiona el estado de cada intento.
 * 
 * @file src/models/RetryQueue.js
 * @module RetryQueue
 * @version 1.0.0
 * @sprint Sprint 6D - Intelligent Error Handling & Recovery
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

const RetryQueue = sequelize.define(
  "RetryQueue",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "ID único del job de retry"
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID de la venta a reintentar",
      references: {
        model: 'sales',
        key: 'id'
      }
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: "Número de intentos realizados"
    },
    maxAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false,
      comment: "Máximo de intentos permitidos"
    },
    nextRetryAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha/hora del próximo intento"
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'resolved', 'failed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false,
      comment: "Estado actual del job"
    },
    errorType: {
      type: DataTypes.ENUM('temporal', 'recoverable', 'critical', 'unknown'),
      allowNull: false,
      comment: "Clasificación del error"
    },
    errorCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Código específico del error (ej: NETWORK_ERROR, ADDRESS_INVALID)"
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Mensaje de error original"
    },
    errorData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Datos adicionales del error (stack, response, etc.)"
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Último error registrado"
    },
    retryHistory: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Historial de todos los intentos con timestamps y resultados"
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha/hora de resolución exitosa"
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha/hora de cancelación manual"
    },
    cancelledBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Usuario que canceló el job (admin email)"
    },
    cancelReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Razón de cancelación"
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: "Prioridad del job (0=normal, 1=alta, -1=baja)"
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Datos adicionales del contexto (customer, amount, etc.)"
    }
  },
  {
    tableName: "retry_queue",
    timestamps: true,
    indexes: [
      {
        fields: ['saleId'],
        name: 'idx_retry_queue_sale'
      },
      {
        fields: ['status'],
        name: 'idx_retry_queue_status'
      },
      {
        fields: ['nextRetryAt'],
        name: 'idx_retry_queue_next_retry'
      },
      {
        fields: ['errorType'],
        name: 'idx_retry_queue_error_type'
      },
      {
        fields: ['status', 'nextRetryAt'],
        name: 'idx_retry_queue_processing'
      }
    ],
    comment: "Cola de reintentos para órdenes fallidas con backoff exponencial"
  }
);

export default RetryQueue;
