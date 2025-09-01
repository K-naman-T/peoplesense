import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MainNav } from "@/components/layout/main-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "People Tracking System",
  description: "Monitor and track people across multiple camera feeds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="grid min-h-screen grid-rows-[auto_1fr_auto]">
          <header className="sticky top-0 z-40 border-b bg-background">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid h-16 grid-cols-[auto_1fr_auto] items-center">
              <div className="flex items-center">
                <a href="/" className="flex items-center space-x-2">
                  <span className="text-xl font-bold">People Tracker</span>
                </a>
              </div>
              <MainNav />
              <div className="flex items-center space-x-4">
                {/* Optional header elements like user profile, theme toggle, etc. */}
              </div>
            </div>
          </header>
          <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 gap-6">
              {children}
            </div>
          </main>
          <footer className="border-t py-6">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <p className="text-sm text-muted-foreground md:text-left text-center">
                &copy; {new Date().getFullYear()} People Tracking System. All rights reserved.
              </p>
              <p className="text-sm text-muted-foreground md:text-right text-center">
                Built with Next.js and Shadcn UI
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
