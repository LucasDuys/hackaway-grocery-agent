export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash");
  const size = searchParams.get("size") || "small";

  if (!hash) return new Response("Missing hash", { status: 400 });

  const url = `https://storefront-prod.nl.picnicinternational.com/static/images/${hash}/${size}.png`;

  try {
    const res = await fetch(url, {
      headers: {
        "x-picnic-agent": "30100;3.3.0",
        "x-picnic-did": "AGENT-001",
        "Referer": "https://storefront-prod.nl.picnicinternational.com",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) return new Response("Image not found", { status: 404 });

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Failed to fetch image", { status: 500 });
  }
}
