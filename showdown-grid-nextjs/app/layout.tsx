import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Snowfall } from "@/components/Snowfall";
import { AppProvider } from "@/components/AppProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JEOPARTY 🥳",
  description:
    "Lag og hold quiz i Jeopardy-stil: eget brett, lag, poeng og historikk.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The interface is Norwegian; lang="en" made screen readers pronounce it
    // as English.
    <html lang="nb">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <AppProvider>
              <Snowfall />
              {children}
              {/* Without this, every toast() call in the app rendered nothing:
                  errors from saving, deleting and switching quiz were silent. */}
              <Toaster />
            </AppProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
