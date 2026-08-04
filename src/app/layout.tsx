import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Padel Manager",
  description: "Organise sessions, score matches and grow your game.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
