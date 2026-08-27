import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spendly',
  description: 'Type what you spent. No forms.',
  applicationName: 'Spendly',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Spendly',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0F14' },
    { media: '(prefers-color-scheme: light)', color: '#F4F7F9' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint so there is no light flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('spendly-theme');if(t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches)||(!t&&matchMedia('(prefers-color-scheme: light)').matches&&false)){document.documentElement.dataset.theme='light'}}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
