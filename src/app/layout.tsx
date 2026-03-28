import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grocery Agent - Hackaway 2026",
  description: "Multi-agent grocery orchestration for Picnic",
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
