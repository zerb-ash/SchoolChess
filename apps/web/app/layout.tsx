import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/layout/Navbar';
import { ActiveGameDock } from '../components/board/ActiveGameDock';

export const metadata: Metadata = {
  title: 'XChess',
  description: 'Pure, authentic online chess platform with multi-system ratings and fair-play integrity.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('schoolchess_user_settings_v1');if(s){var p=JSON.parse(s);var l=p.themeName==='custom'?p.customLight:(p.themeName==='classic_salon'?'#ede3d1':p.themeName==='tournament'?'#eeeed2':p.themeName==='obsidian'?'#e2d9c8':'#f0d9b5');var d=p.themeName==='custom'?p.customDark:(p.themeName==='classic_salon'?'#8a6240':p.themeName==='tournament'?'#5b7c4b':p.themeName==='obsidian'?'#3a332d':'#b58863');document.documentElement.style.setProperty('--board-light',l);document.documentElement.style.setProperty('--board-dark',d);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-wood-950 text-parchment-100 flex flex-col antialiased selection:bg-brass-500 selection:text-wood-950">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <ActiveGameDock />
      </body>
    </html>
  );
}

