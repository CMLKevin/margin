import type { Metadata } from "next";
import "./globals.css";
import "./research-desk.css";
import "./desktop-desk.css";
import "./setup.css";

export const metadata: Metadata = {
  title: "Margin — a research inbox",
  description: "Independent AI research, collected at the source. An inbox for humans, a library for agents.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script src="/theme.js" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
