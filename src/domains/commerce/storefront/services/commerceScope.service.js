/**
 * Resolves the configured Ecommerce tenant.
 * Independent from logistics providers and request parameters.
 */
export function resolveCommerceScope() {
  const configured = process.env.ECOMMERCE_TENANT_ID;

  if (configured === 'null') {
    return { tenant_id: null };
  }

  if (
    typeof configured !== 'string' ||
    !/^[1-9][0-9]{0,9}$/.test(configured)
  ) {
    return null;
  }

  const tenantId = Number(configured);

  if (
    !Number.isSafeInteger(tenantId) ||
    tenantId > 2147483647
  ) {
    return null;
  }

  return { tenant_id: tenantId };
}
