import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { WalletProvider } from "@/lib/stacks/wallet";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BitYield — Hold Bitcoin. Earn Bitcoin.",
  description:
    "Deposit sBTC and earn yield paid in Bitcoin — non-custodial, no bridges to manage, and zero gas fees. Live on Bitcoin mainnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="font-sans">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
