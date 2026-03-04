import type { Metadata } from "next";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { Syne } from "next/font/google";
import { ThemedToaster } from "@/components/ThemedToaster";
import RealtimeNotifications from "@/components/RealtimeNotifications";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "Sharable",
  description: "Share everything with Sharable",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning className={`${syne.variable}`}>
        <body className="antialiased font-sans bg-background text-foreground">
        <ThemeProvider>
          <LanguageProvider>
              <Script
                id="orchids-browser-logs"
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts/orchids-browser-logs.js"
                strategy="afterInteractive"
                data-orchids-project-id="7c8f01bf-0509-4f8d-a053-fb60239a3077"
              />
              <ErrorReporter />
              <Script
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
                strategy="afterInteractive"
                data-target-origin="*"
                data-message-type="ROUTE_CHANGE"
                data-include-search-params="true"
                data-only-in-iframe="true"
                data-debug="true"
                data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
              />
              {children}
                <ThemedToaster />
                <RealtimeNotifications />
                <VisualEditsMessenger />
            </LanguageProvider>
          </ThemeProvider>
        </body>
      </html>
    );
}

