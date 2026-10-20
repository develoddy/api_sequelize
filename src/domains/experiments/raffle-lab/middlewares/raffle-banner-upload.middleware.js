import multer from 'multer';

const MAX_BANNER_SIZE = 5 * 1024 * 1024;

export const uploadRaffleBanner = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_BANNER_SIZE,
        files: 1,
    },
    fileFilter(req, file, callback) {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error('Formato de imagen no permitido.'));
        }

        callback(null, true);
    },
}).single('banner');
