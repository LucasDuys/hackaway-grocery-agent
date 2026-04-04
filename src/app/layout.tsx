import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroceryOptimizer - Dutch Supermarket Price Comparison",
  description:
    "Find the cheapest groceries across all Dutch supermarkets. Compare prices, build shopping lists, and save money every week.",
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
