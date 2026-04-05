import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GroceryOptimizer - Cheapest Groceries in the Netherlands",
    template: "%s | GroceryOptimizer",
  },
  description:
    "Find the cheapest groceries across all Dutch supermarkets. Compare prices from Albert Heijn, Jumbo, Lidl, Aldi, Plus, and Picnic. Save money every week.",
  openGraph: {
    title: "GroceryOptimizer - Cheapest Groceries in the Netherlands",
    description:
      "Compare prices across Albert Heijn, Jumbo, Lidl, Aldi, Plus, and Picnic. Build optimized shopping lists and save money.",
    type: "website",
    locale: "nl_NL",
    siteName: "GroceryOptimizer",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GroceryOptimizer - Dutch Supermarket Price Comparison",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GroceryOptimizer - Cheapest Groceries in the Netherlands",
    description:
      "Compare prices across Albert Heijn, Jumbo, Lidl, Aldi, Plus, and Picnic. Build optimized shopping lists and save money.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
