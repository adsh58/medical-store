import React from "react";
import Providers from "./providers";
import "./globals.css";

export const metadata = {
  title: "MedStore Pro",
  description: "Medical Store Management & AI Auditing System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

