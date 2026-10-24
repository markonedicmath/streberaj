import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Štreberaj",
  description: "Raspored i evidencija privatnih časova.",
  icons: {
    icon: [{ url: "/streberaj-icon.png", type: "image/png" }],
    apple: "/streberaj-icon.png",
  },
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
