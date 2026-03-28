import { NextRequest, NextResponse } from "next/server";
import { PicnicClient } from "@/lib/picnic/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/product-detail?id=s1234
 *
 * Proxies to Picnic hackathon-get-product endpoint and returns
 * enriched product data including description, images, nutritional info.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Missing required query parameter: id" },
      { status: 400 }
    );
  }

  try {
    const client = new PicnicClient();
    const data = await client.get("hackathon-get-product", {
      selling_unit_id: id,
    });

    // The API returns the product fields at the top level.
    // We normalize to a consistent shape.
    const product = data as Record<string, unknown>;

    return NextResponse.json({
      id: product.id ?? id,
      name: product.name ?? "",
      brand: product.brand ?? undefined,
      description: product.description ?? undefined,
      price: product.price ?? undefined,
      unit_quantity: product.unit_quantity ?? undefined,
      image_url: product.image_url ?? undefined,
      images: product.images ?? undefined,
      max_order_quantity: product.max_order_quantity ?? undefined,
      nutritional_info: product.nutritional_info ?? undefined,
    });
  } catch (err) {
    console.error("[product-detail] Failed to fetch product:", err);
    return NextResponse.json(
      { error: "Failed to fetch product detail" },
      { status: 500 }
    );
  }
}
