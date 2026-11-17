import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/layout/Navbar';

export const metadata: Metadata = {
  title: 'SchoolChess | Full-Scale Server-Authoritative Chess Platform',
  description: 'High-performance chess platform with multi-system ratings (FIDE, Chess.com, Lichess), instant matchmaking, and server-authoritative integrity.',
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

