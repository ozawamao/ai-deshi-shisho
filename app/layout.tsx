import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI弟子 & AI師匠",
  description: "職人の暗黙知を音声対話で集めて伝える",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
