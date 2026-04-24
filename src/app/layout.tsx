import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/src/features/auth/hooks/useAuth';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Teleparty Clone',
  description: 'Assista vídeos com seus amigos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased bg-[#050505] text-white min-h-screen flex flex-col overflow-x-hidden relative">
        <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-purple-600/10 blur-[100px] pointer-events-none rounded-full z-[-1]"></div>
        <div className="fixed -top-24 -right-24 w-96 h-96 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full z-[-1]"></div>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
