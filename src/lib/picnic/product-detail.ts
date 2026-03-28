/**
 * Client-side product detail fetcher with in-memory cache.
 * Calls /api/product-detail which proxies to the Picnic hackathon-get-product endpoint.
 */

export interface NutritionalValue {
  name: string;
  value: string;
  gda_percentage?: string;
}

export interface ProductDetail {
  id: string;
  name: string;
  brand?: string;
  description?: string;
  price?: number; // cents
  unit_quantity?: string;
  image_url?: string;
  images?: string[];
  max_order_quantity?: number;
  nutritional_info?: NutritionalValue[];
}

const cache = new Map<string, ProductDetail>();

export async function fetchProductDetail(
  sellingUnitId: string
): Promise<ProductDetail | null> {
  if (cache.has(sellingUnitId)) return cache.get(sellingUnitId)!;

  try {
    const res = await fetch(
      `/api/product-detail?id=${encodeURIComponent(sellingUnitId)}`
    );
    if (!res.ok) return null;

    const data: ProductDetail = await res.json();
    cache.set(sellingUnitId, data);
    return data;
  } catch {
    return null;
  }
}
