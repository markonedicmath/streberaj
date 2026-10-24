import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Štreberaj",
  description: "Raspored i evidencija privatnih časova.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr-Latn">
      <body>{children}</body>
    </html>
  );
}
