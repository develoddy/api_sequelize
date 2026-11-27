import axios from 'axios';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

async function fetchCompleteInventory(client, path) {
  const records = [];
  let expectedTotal = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = records.length;

    const { data: response } = await client.get(path, {
      params: {
        limit: PAGE_SIZE,
        offset
      }
    });

    const rows = response?.data;
    const paging = response?.paging;

    if (
      !Array.isArray(rows) ||
      !Number.isSafeInteger(paging?.total) ||
      paging.total < 0 ||
      paging.offset !== offset ||
      rows.length > PAGE_SIZE
    ) {
      throw new Error('Invalid Printful inventory response');
    }

    if (expectedTotal === null) {
      expectedTotal = paging.total;
    }

    if (paging.total !== expectedTotal) {
      throw new Error('Printful inventory changed during pagination');
    }

    records.push(...rows);

    if (records.length > expectedTotal) {
      throw new Error('Invalid Printful inventory size');
    }

    if (records.length === expectedTotal) {
      return records;
    }

    if (!rows.length) {
      throw new Error('Incomplete Printful inventory');
    }
  }

  throw new Error('Printful inventory pagination limit exceeded');
}

export async function fetchPrintfulLogistics({
  orderId,
  storeId,
  apiToken
}) {
  const id = String(orderId ?? '');
  const store = String(storeId ?? '');

  if (
    !/^[1-9][0-9]{0,19}$/.test(id) ||
    !/^[1-9][0-9]{0,19}$/.test(store) ||
    typeof apiToken !== 'string' ||
    !apiToken.trim()
  ) {
    throw new Error('Invalid Printful logistics configuration');
  }

  const client = axios.create({
    baseURL: 'https://api.printful.com/v2',
    timeout: 5000,
    maxRedirects: 0,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'X-PF-Store-Id': store
    }
  });

  const path = `/orders/${id}`;

  const { data: response } = await client.get(path);
  const order = response?.data;

  if (
    !order ||
    String(order.id) !== id ||
    String(order.store_id) !== store ||
    typeof order.status !== 'string'
  ) {
    throw new Error('Printful order identity mismatch');
  }

  const [orderItems, providerShipments] = await Promise.all([
    fetchCompleteInventory(client, `${path}/order-items`),
    fetchCompleteInventory(client, `${path}/shipments`)
  ]);

  return {
    orderId: id,
    providerStatus: order.status,
    orderItems,
    providerShipments,
    inventoryComplete: true
  };
}
