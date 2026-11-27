import crypto from 'node:crypto';

export function verifyPrintfulV2Signature({
  rawBody,
  signature,
  publicKey,
  expectedPublicKey,
  secretKey
}) {
  if (!Buffer.isBuffer(rawBody)) return false;

  if (
    typeof publicKey !== 'string' ||
    !expectedPublicKey ||
    publicKey !== expectedPublicKey
  ) {
    return false;
  }

  if (
    typeof secretKey !== 'string' ||
    !/^(?:[a-fA-F0-9]{2})+$/.test(secretKey)
  ) {
    return false;
  }

  if (
    typeof signature !== 'string' ||
    !/^[a-fA-F0-9]{64}$/.test(signature)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', Buffer.from(secretKey, 'hex'))
    .update(rawBody)
    .digest();

  const received = Buffer.from(signature, 'hex');

  return crypto.timingSafeEqual(expected, received);
}
