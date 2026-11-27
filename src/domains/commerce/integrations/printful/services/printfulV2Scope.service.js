export function resolvePrintfulV2Scope() {
  const configured = process.env.PRINTFUL_V2_TENANT_ID;

  if (configured === 'null') {
    return { tenant_id: null, module_id: null };
  }

  if (
    typeof configured !== 'string' ||
    !/^[1-9][0-9]*$/.test(configured)
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

  return {
    tenant_id: tenantId,
    module_id: null
  };
}

export function isPrintfulV2ScopedSale(sale) {
  const scope = resolvePrintfulV2Scope();

  if (!scope || !sale) {
    return false;
  }

  return (
    sale.tenant_id === scope.tenant_id &&
    sale.module_id === scope.module_id
  );
}
