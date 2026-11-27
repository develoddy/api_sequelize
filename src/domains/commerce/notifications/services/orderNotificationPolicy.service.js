export function usesV2OrderNotifications(sale) {
  if (
    process.env.PRINTFUL_V2_NOTIFICATIONS_ENABLED !== 'true' ||
    !sale ||
    sale.tenant_id != null ||
    sale.module_id != null
  ) {
    return false;
  }

  const configuredCutover =
    process.env.PRINTFUL_V2_NOTIFICATIONS_CUTOVER_AT;

  if (
    !configuredCutover ||
    !configuredCutover.endsWith('Z') ||
    !sale.createdAt
  ) {
    return false;
  }

  const cutover = Date.parse(configuredCutover);
  const createdAt = new Date(sale.createdAt).getTime();

  return (
    Number.isFinite(cutover) &&
    Number.isFinite(createdAt) &&
    createdAt >= cutover
  );
}
