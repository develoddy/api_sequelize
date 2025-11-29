/**
 * AnalyticsCache Model
 * 
 * Cachea métricas calculadas para mejorar performance del dashboard.
 * Se actualiza mediante cron jobs diarios que agregan datos de Sales.
 * 
 * @file src/models/AnalyticsCache.js
 * @module AnalyticsCache
 * @version 1.0.0
 * @sprint Sprint 6E - Analytics & Reporting
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

const AnalyticsCache = sequelize.define(
  "AnalyticsCache",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "ID único del registro de analytics"
    },
    metricType: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'),
      allowNull: false,
      comment: "Tipo de agregación temporal",
      field: 'metricType'
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Fecha de la métrica (inicio del período)"
    },
    revenue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Revenue total del período"
    },
    costs: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Costos totales Printful (productos + envío)"
    },
    profit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Ganancia neta (revenue - costs)"
    },
    margin: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Margen de ganancia en porcentaje"
    },
    orderCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total de órdenes",
      field: 'orderCount'
    },
    syncedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Órdenes sincronizadas exitosamente",
      field: 'syncedCount'
    },
    pendingCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Órdenes pendientes de sync",
      field: 'pendingCount'
    },
    shippedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Órdenes enviadas",
      field: 'shippedCount'
    },
    deliveredCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Órdenes entregadas",
      field: 'deliveredCount'
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Órdenes fallidas",
      field: 'failedCount'
    },
    successRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Tasa de éxito en porcentaje",
      field: 'successRate'
    },
    avgFulfillmentTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Tiempo promedio de fulfillment en horas",
      field: 'avgFulfillmentTime'
    },
    productCosts: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Desglose de costos por producto { productId: cost }",
      field: 'productCosts'
    },
    shippingCosts: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Costos de envío totales",
      field: 'shippingCosts'
    },
    avgOrderValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Valor promedio de orden (AOV)",
      field: 'avgOrderValue'
    },
    customerStats: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Estadísticas de clientes { new, returning, users, guests }",
      field: 'customerStats'
    },
    paymentMethods: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Revenue por método de pago { stripe: X, paypal: Y }",
      field: 'paymentMethods'
    },
    topProducts: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Top 10 productos del período [{ productId, revenue, units }]",
      field: 'topProducts'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Datos adicionales flexibles"
    }
  },
  {
    tableName: "analytics_cache",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['metricType', 'date'],
        name: 'idx_analytics_metric_date'
      },
      {
        fields: ['date'],
        name: 'idx_analytics_date'
      },
      {
        fields: ['metricType'],
        name: 'idx_analytics_type'
      },
      {
        fields: ['date', 'metricType'],
        name: 'idx_analytics_date_type'
      }
    ],
    comment: "Cache de métricas agregadas para analytics dashboard"
  }
);

export default AnalyticsCache;
