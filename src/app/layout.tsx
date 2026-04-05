import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroceryOptimizer - Dutch Supermarket Price Comparison",
  description:
    "Find the cheapest groceries across all Dutch supermarkets. Compare prices from Albert Heijn, Jumbo, Lidl, Aldi, Plus, and Picnic. Save money every week.",
  openGraph: {
    title: "GroceryOptimizer - Dutch Supermarket Price Comparison",
    description:
      "Compare prices from Albert Heijn, Jumbo, Lidl, Aldi, Plus, and Picnic. Save money every week.",
    type: "website",
    locale: "en_NL",
    siteName: "GroceryOptimizer",
  },
  twitter: {
    card: "summary_large_image",
    title: "GroceryOptimizer - Dutch Supermarket Price Comparison",
    description:
      "Compare prices from Albert Heijn, Jumbo, Lidl, Aldi, Plus, and Picnic. Save money every week.",
  },
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
