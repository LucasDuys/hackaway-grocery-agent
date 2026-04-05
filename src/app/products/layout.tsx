import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Search",
};

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
