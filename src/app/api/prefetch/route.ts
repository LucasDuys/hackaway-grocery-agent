import { prefetchAll } from "@/lib/picnic/prefetch";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await prefetchAll();
    return Response.json({
      success: true,
      orders: data.orders.length,
      products: Object.values(data.searchResults).flat().length,
      slots: data.deliverySlots.length,
    });
  } catch (err) {
    return Response.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
