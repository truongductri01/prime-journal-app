import type { Metadata } from "next";
import "./globals.css";
import { AppWrapper } from "@/components/AppWrapper";

export const metadata: Metadata = {
  title: "The Prime Journal - Life Game System",
  description: "A high-integrity life optimization system disguised as a tactical RPG interface.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Load Google Fonts and Material Symbols Outlined */}
        <link 
          href="https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400..900;1,400..900&family=Manrope:wght@200..800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="parchment-texture selection:bg-secondary-container">
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
