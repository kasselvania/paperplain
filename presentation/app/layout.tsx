import type { Metadata } from "next";

import "./globals.css";

const title = "Paperplain — Verified PDF-to-Markdown samples";
const description =
  "A public Paperplain demo that converts one of three fictional PDFs through a server-signed fixed-sample route and reveals Markdown only after a successful run.";

export const metadata: Metadata = {
  title,
  description,
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  openGraph: {
    title,
    description,
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
