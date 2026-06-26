export interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  line_items: ShopifyLineItem[];
  financial_status: string;
  fulfillment_status: string | null;
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
}

export interface DailyStats {
  ca: number;
  orders: number;
  items: number;
}

/** Verify a Shopify custom app token and return the shop name */
export async function getShopInfo(domain: string, token: string): Promise<{ name: string; email: string }> {
  const res = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return { name: data.shop.name, email: data.shop.email };
}

/** Fetch all orders in a date range (handles pagination) */
export async function fetchOrders(
  domain: string,
  token: string,
  startDate?: string,
  endDate?: string
): Promise<ShopifyOrder[]> {
  const orders: ShopifyOrder[] = [];
  let url: string | null = buildOrdersUrl(domain, startDate, endDate);

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    if (!res.ok) throw new Error(`Shopify orders fetch failed (${res.status})`);
    const data = await res.json();
    orders.push(...(data.orders || []));

    // Handle cursor-based pagination
    const linkHeader = res.headers.get('Link') || '';
    url = extractNextPageUrl(linkHeader);
  }

  return orders;
}

/** Group orders by day → daily stats map */
export function groupByDay(orders: ShopifyOrder[]): Record<string, DailyStats> {
  const map: Record<string, DailyStats> = {};
  for (const order of orders) {
    if (order.financial_status === 'refunded') continue;
    const day = order.created_at.slice(0, 10); // YYYY-MM-DD
    if (!map[day]) map[day] = { ca: 0, orders: 0, items: 0 };
    map[day].ca += parseFloat(order.total_price);
    map[day].orders += 1;
    map[day].items  += order.line_items.reduce((s, l) => s + l.quantity, 0);
  }
  return map;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildOrdersUrl(domain: string, startDate?: string, endDate?: string): string {
  const params = new URLSearchParams({
    status: 'any',
    limit:  '250',
    fields: 'id,name,created_at,total_price,subtotal_price,total_discounts,line_items,financial_status,fulfillment_status',
  });
  if (startDate) params.set('created_at_min', `${startDate}T00:00:00Z`);
  if (endDate)   params.set('created_at_max', `${endDate}T23:59:59Z`);
  return `https://${domain}/admin/api/2024-01/orders.json?${params}`;
}

function extractNextPageUrl(linkHeader: string): string | null {
  // Shopify Link header format: <url>; rel="next", <url>; rel="previous"
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
