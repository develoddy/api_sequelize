import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

const SitemapUrl = sequelize.define('sitemap_urls', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    loc: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'URL completa de la página',
        validate: {
            isValidUrl(value) {
                if (!value || typeof value !== 'string') {
                    throw new Error('loc debe ser una cadena válida');
                }
                // Validar que comience con http:// o https://
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                    throw new Error('loc debe comenzar con http:// o https://');
                }
                // Validar formato básico de URL
                try {
                    new URL(value);
                } catch (err) {
                    throw new Error('loc no es una URL válida');
                }
            }
        }
    },
    lastmod: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de última modificación'
    },
    changefreq: {
        type: DataTypes.ENUM('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'),
        allowNull: false,
        defaultValue: 'weekly',
        comment: 'Frecuencia de cambio'
    },
    priority: {
        type: DataTypes.DECIMAL(2, 1),
        allowNull: false,
        defaultValue: 0.5,
        comment: 'Prioridad (0.0 - 1.0)',
        validate: {
            min: 0.0,
            max: 1.0
        }
    },
    type: {
        type: DataTypes.ENUM('static', 'product', 'category', 'custom'),
        allowNull: false,
        defaultValue: 'custom',
        comment: 'Tipo de URL'
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'URL activa en el sitemap'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Metadata adicional (productId, categoryId, etc.)'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'sitemap_urls',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['loc']
        },
        {
            fields: ['type']
        },
        {
            fields: ['enabled']
        },
        {
            fields: ['lastmod']
        }
    ]
});

export default SitemapUrl;
