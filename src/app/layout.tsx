import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Revv", template: "%s · Revv" },
  description: "Manutenções, upgrades, abastecimentos e gastos dos seus veículos em um só lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
