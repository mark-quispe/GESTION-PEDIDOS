import type { Metadata, Viewport } from "next";
import { Geist_Mono, Work_Sans } from "next/font/google";
import "./globals.css";
import { themeScript } from "@/lib/theme";

const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gestión de pedidos", template: "%s · Gestión de pedidos" },
  description: "Herramienta interna para registrar y gestionar pedidos.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Pedidos", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecebe6" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script de tema añade data-theme antes de hidratar.
    <html lang="es" suppressHydrationWarning className={`${workSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
