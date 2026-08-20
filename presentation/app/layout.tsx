import type { Metadata } from "next";

import "./globals.css";

const title = "Paperplain — Verified PDF-to-Markdown samples";
const description =
  "An owner-only Paperplain integration candidate with three fixed fictional PDFs, captured baselines, and a server-signed private conversion path.";

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
  robots: {
    index: false,
    follow: false,
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
