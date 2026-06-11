import type { Metadata } from 'next';
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";
import ForceDarkMode from "../components/ForceDarkMode";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShadowIDE - Your Local AI Code Editor",
  description: "A modern code editor with built-in AI assistance that runs entirely on your machine. Experience local AI coding with privacy and zero latency.",
  keywords: ["code editor", "AI coding", "local AI", "privacy-first", "code completion", "local development", "AI assistant", "programming", "development tools"],
  authors: [{ name: "Das_F1sHy312" }],
  creator: "Das_F1sHy312",
  publisher: "Das_F1sHy312",
  openGraph: {
    title: "ShadowIDE - Your Local AI Code Editor",
    description: "A modern code editor with built-in AI assistance that runs entirely on your machine. Experience local AI coding with privacy and zero latency.",
    type: "website",
    locale: "en_US",
    siteName: "ShadowIDE",
    images: [
      {
        url: '/metadata-min.png',
        width: 1200,
        height: 630,
        alt: 'ShadowIDE - Your Local AI Code Editor',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ShadowIDE - Your Local AI Code Editor",
    description: "A modern code editor with built-in AI assistance that runs entirely on your machine. Experience local AI coding with privacy and zero latency.",
    images: ['/metadata-min.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/logo-min.png', sizes: 'any' },
    ],
    apple: [
      { url: '/logo-min.png', sizes: 'any' },
    ],
  },
  alternates: {
    types: {
      'application/rss+xml': [
        { url: 'https://shadowide.com/atom.xml', title: 'ShadowIDE Blog | RSS Feed' },
        { url: 'https://shadowide.com/rss.xml', title: 'ShadowIDE Blog | RSS Feed' },
      ],
      'application/json': [
        { url: 'https://shadowide.com/rss.json', title: 'ShadowIDE Blog | RSS Feed' },
      ],
    },
  },
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth dark" style={{ colorScheme: 'dark' }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="next-size-adjust" content="" />
        <meta name="color-scheme" content="dark" />
        <link rel="icon" href="/logo-min.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-min.png" />
        <meta name="apple-mobile-web-app-title" content="ShadowIDE" />
        <meta name="theme-color" content="#050505" />
        <script src="/_vercel/speed-insights/script.js" defer data-sdkn="@vercel/speed-insights/next" data-sdkv="1.1.0" data-route="/" />
        <script src="/_vercel/insights/script.js" defer data-sdkn="@vercel/analytics/next" data-sdkv="1.4.0" data-disable-auto-track="1" />
      </head>
      <body 
        className={`${inter.className} bg-background text-white dark`}
        suppressHydrationWarning
      >
        <ForceDarkMode />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
