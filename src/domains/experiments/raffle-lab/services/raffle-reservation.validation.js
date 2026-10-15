export function validateReservationInput(
    participantName,
    values,
    durationMinutes = 15
) {
    const name = typeof participantName === 'string'
        ? participantName.trim()
        : '';

    if (
        !name ||
        name.length > 150 ||
        !Number.isFinite(durationMinutes) ||
        durationMinutes <= 0 ||
        !Array.isArray(values) ||
        values.length === 0 ||
        new Set(values).size !== values.length ||
        values.some(value =>
            !Number.isSafeInteger(value) ||
            value < 1 ||
            value > 4294967295
        )
    ) {
        return null;
    }

    const durationMilliseconds = durationMinutes * 60 * 1000;

    const expiresAt = new Date(Date.now() + durationMilliseconds);
    const maxMysqlDate = new Date('9999-12-31T23:59:59.000Z');

    if (
        !Number.isFinite(durationMilliseconds) ||
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt > maxMysqlDate
    ) {
        return null;
    }

    return {
        participantName: name,
        values: [...values],
        durationMilliseconds,
    };
}
