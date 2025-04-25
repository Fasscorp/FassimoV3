import type { Metadata } from 'next';
import { Outfit } from 'next/font/google'; // Import Outfit font
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

// Instantiate Outfit font
const outfit = Outfit({
  variable: '--font-outfit', // Define CSS variable
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FASSIMO v3.0', // Updated title
  description: 'Multi-Agent AI System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      {/* Apply Outfit font variable to body */}
      <body className={`${outfit.variable} font-sans antialiased`}> {/* Use font-sans which will default to --font-outfit */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
