import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

/**
 * MODELO: VideoJob
 * 
 * Representa un trabajo de generación de video con IA
 * Cada registro es un request para convertir una imagen en video
 */
export const VideoJob = sequelize.define('video_jobs', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },

    // Relación con usuario
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Nullable para preview jobs (sin auth)
        comment: 'ID del usuario admin que creó el job (null para preview)'
    },

    // INPUT: Imagen del producto
    product_image_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Ruta de la imagen del producto (local o S3)'
    },

    product_image_filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nombre original del archivo'
    },

    // Estilo de animación
    animation_style: {
        type: DataTypes.ENUM('zoom_in', 'parallax', 'subtle_float'),
        allowNull: false,
        defaultValue: 'parallax',
        comment: 'Tipo de animación cinematográfica'
    },

    // Estado del job
    status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Estado actual del job'
    },

    // Preview Mode (jobs sin autenticación)
    is_preview: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag para jobs de preview (sin auth)'
    },

    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP del usuario (para rate limiting en preview)'
    },

    preview_objective: {
        type: DataTypes.ENUM('organic', 'ads'),
        allowNull: true,
        comment: 'Objetivo seleccionado en preview'
    },

    preview_feedback: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: 'Feedback del usuario: ¿el video fue útil?'
    },

    preview_feedback_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cuándo se dio el feedback'
    },

    // Integración con fal.ai
    fal_request_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        comment: 'ID del request en fal.ai'
    },

    // OUTPUT: Video generado
    output_video_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL del video final'
    },

    output_video_filename: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nombre del archivo de video'
    },

    duration_seconds: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Duración del video en segundos'
    },

    // Manejo de errores
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mensaje de error si falla'
    },

    error_code: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Código de error para debugging'
    },

    // Métricas
    processing_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Tiempo total de procesamiento'
    },

    fal_processing_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Tiempo reportado por fal.ai'
    },

    // Timestamps
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cuándo terminó el job'
    },

    // Protección de créditos
    is_simulated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'true si es video placeholder (SIMULATION_MODE o límite alcanzado)'
    }

}, {
    timestamps: true,
    tableName: 'video_jobs',
    underscored: true, // usa snake_case para created_at, updated_at
    
    // Métodos de instancia útiles
    instanceMethods: {
        /**
         * Verifica si el job está en estado de procesamiento
         */
        isProcessing() {
            return this.status === 'processing';
        },

        /**
         * Verifica si el job ha terminado (success o fail)
         */
        isFinished() {
            return ['completed', 'failed'].includes(this.status);
        },

        /**
         * Marca el job como completado
         */
        async markAsCompleted(videoUrl, videoFilename, durationSeconds, processingTimeMs) {
            this.status = 'completed';
            this.output_video_url = videoUrl;
            this.output_video_filename = videoFilename;
            this.duration_seconds = durationSeconds;
            this.processing_time_ms = processingTimeMs;
            this.completed_at = new Date();
            await this.save();
        },

        /**
         * Marca el job como fallido
         */
        async markAsFailed(errorMessage, errorCode = null) {
            this.status = 'failed';
            this.error_message = errorMessage;
            this.error_code = errorCode;
            this.completed_at = new Date();
            await this.save();
        }
    }
});

// Métodos de clase (estáticos) útiles

/**
 * Obtiene jobs pendientes de polling (para el cron job)
 */
VideoJob.getPendingJobs = async function() {
    return await this.findAll({
        where: {
            status: 'processing',
            fal_request_id: {
                [sequelize.Sequelize.Op.ne]: null // no null
            }
        },
        order: [['created_at', 'ASC']]
    });
};

/**
 * Obtiene jobs recientes de un usuario
 */
VideoJob.getRecentJobsByUser = async function(userId, limit = 10) {
    return await this.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        limit
    });
};

/**
 * Obtiene estadísticas de jobs de un usuario
 */
VideoJob.getUserStats = async function(userId) {
    const jobs = await this.findAll({
        where: { user_id: userId },
        attributes: ['status']
    });

    const stats = {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        pending: jobs.filter(j => j.status === 'pending').length
    };

    return stats;
};
