import type { Metadata } from "next";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ThemedToaster } from "@/components/ThemedToaster";
import RealtimeNotifications from "@/components/RealtimeNotifications";
import PresenceProvider from "@/components/PresenceProvider";
import MediaContextMenuBlocker from "@/components/MediaContextMenuBlocker";
import { NavigationHistoryProvider } from "@/components/NavigationHistoryProvider";
import { ThemeColorMeta } from "@/components/ThemeColorMeta";


const APP_URL = 'https://sharableofc.vercel.app';

export const metadata: Metadata = {
  title: {
    default: "Sharable",
    template: "%s | Sharable",
  },
  description: "Share anything with the world.",
  metadataBase: new URL(APP_URL),
  keywords: ["sharable", "social", "share", "posts", "community"],
  authors: [{ name: "Sharable" }],
  creator: "Sharable",
  publisher: "Sharable",

  // Open Graph — controls how the link looks when shared on WhatsApp, Facebook etc.
  openGraph: {
    title: "Sharable",
    description: "Share anything with the world.",
    siteName: "Sharable",
    url: APP_URL,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/sharable.logo.png",
        width: 512,
        height: 512,
        alt: "Sharable",
      },
    ],
  },

  // Twitter / X card
  twitter: {
    card: "summary",
    title: "Sharable",
    description: "Share anything with the world.",
    images: ["/sharable.logo.png"],
  },

  // PWA manifest
  manifest: "/manifest.json",

  // Icons — all pointing to the same Sharable logo
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon.png",
  },

  // Apple PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sharable",
    startupImage: ["/sharable.logo.png"],
  },

  // Google Sitelinks Searchbox — shows quick links under the result
  alternates: {
    canonical: APP_URL,
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};



export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f0f0" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
        <body className="antialiased font-sans bg-background text-foreground">
        <ThemeProvider>
          <NavigationHistoryProvider>
          <LanguageProvider>
            <PresenceProvider>
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
              {/* JSON-LD: tells Google the site name, logo, and sitelinks (Login / Create Account) */}
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    "name": "Sharable",
                    "description": "Share anything with the world.",
                    "url": "https://sharableofc.vercel.app",
                    "logo": "https://sharableofc.vercel.app/sharable.logo.png",
                    "potentialAction": [
                      {
                        "@type": "SearchAction",
                        "target": {
                          "@type": "EntryPoint",
                          "urlTemplate": "https://sharableofc.vercel.app/search?q={search_term_string}"
                        },
                        "query-input": "required name=search_term_string"
                      }
                    ],
                    "sameAs": [],
                    "hasPart": [
                      {
                        "@type": "WebPage",
                        "name": "Login",
                        "url": "https://sharableofc.vercel.app/?view=login"
                      },
                      {
                        "@type": "WebPage",
                        "name": "Create Account",
                        "url": "https://sharableofc.vercel.app/?view=register"
                      }
                    ]
                  })
                }}
              />
              <ThemeColorMeta />
              {children}
                <ThemedToaster />
                <RealtimeNotifications />
                <VisualEditsMessenger />
                <MediaContextMenuBlocker />
            </PresenceProvider>
            </LanguageProvider>
          </NavigationHistoryProvider>
          </ThemeProvider>
        </body>
      </html>
    );
}
