import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/layout/Navbar';

export const metadata: Metadata = {
  title: 'XChess | Classical Chess Platform',
  description: 'Pure, authentic online chess platform with multi-system ratings and fair-play integrity.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-wood-950 text-parchment-100 flex flex-col antialiased selection:bg-brass-500 selection:text-wood-950">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}

