import cron from 'node-cron';
import { processExpiredReservations } from '../services/raffle-expiration.service.js';

const RAFFLE_EXPIRATION_SCHEDULE = '* * * * *';

export function startRaffleExpirationCron() {
    if (
        process.env.ENABLE_CRON_JOBS === 'false' ||
        process.env.RAFFLE_LAB_CRON_ENABLED !== 'true'
    ) {
        console.log('[Raffle Lab] Cron de expiración desactivado.');
        return null;
    }

    const task = cron.schedule(
        RAFFLE_EXPIRATION_SCHEDULE,
        async () => {
            try {
                const result = await processExpiredReservations({
                    limit: 50,
                });

                if (result.selected > 0) {
                    console.log(
                        '[Raffle Lab] Procesamiento de expiraciones:',
                        result
                    );
                }
            } catch (error) {
                console.error(
                    '[Raffle Lab] Error en cron de expiración:',
                    error
                );
            }
        },
        {
            name: 'raffle-lab-expiration',
            noOverlap: true,
        }
    );

    console.log(
        '[Raffle Lab] Cron de expiración iniciado (cada minuto).'
    );

    return task;
}
