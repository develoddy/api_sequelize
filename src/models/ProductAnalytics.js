/**
 * ProductAnalytics Model
 * 
 * Métricas por producto para análisis de performance.
 * Se actualiza diariamente mediante cron job que agrega datos de SaleDetails.
 * 
 * @file src/models/ProductAnalytics.js
 * @module ProductAnalytics
 * @version 1.0.0
 * @sprint Sprint 6E - Analytics & Reporting
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

const ProductAnalytics = sequelize.define(
  "ProductAnalytics",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "ID único del registro"
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID del producto",
      references: {
        model: 'products',
        key: 'id'
      },
      field: 'productId'
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Fecha de las métricas"
    },
    unitsSold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Unidades vendidas en la fecha",
      field: 'unitsSold'
    },
    revenue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Revenue generado por el producto"
    },
    printfulCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Costo total Printful del producto",
      field: 'printfulCost'
    },
    profit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "Ganancia neta del producto"
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
      comment: "Número de órdenes que incluyen este producto",
      field: 'orderCount'
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Órdenes fallidas que incluyen este producto",
      field: 'failedCount'
    },
    avgPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Precio promedio del producto",
      field: 'avgPrice'
    },
    topVariants: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Variantes más vendidas [{ variantId, units, revenue }]",
      field: 'topVariants'
    },
    customerSegment: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Segmentación de clientes { users, guests }",
      field: 'customerSegment'
    },
    conversionRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Tasa de conversión si hay datos de vistas",
      field: 'conversionRate'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Datos adicionales flexibles"
    }
  },
  {
    tableName: "product_analytics",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['productId', 'date'],
        name: 'idx_product_analytics_product_date'
      },
      {
        fields: ['date'],
        name: 'idx_product_analytics_date'
      },
      {
        fields: ['productId'],
        name: 'idx_product_analytics_product'
      },
      {
        fields: ['revenue'],
        name: 'idx_product_analytics_revenue'
      },
      {
        fields: ['unitsSold'],
        name: 'idx_product_analytics_units'
      }
    ],
    comment: "Métricas de performance por producto"
  }
);

export default ProductAnalytics;
