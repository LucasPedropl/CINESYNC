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
      <body className="font-sans antialiased text-white min-h-screen flex flex-col overflow-x-hidden relative bg-[#0a0502]">
        <div 
          className="fixed inset-0 pointer-events-none z-[-1]"
          style={{
            background: `radial-gradient(circle at 50% 30%, #3a1510 0%, transparent 60%), radial-gradient(circle at 10% 80%, #9333ea 0%, transparent 50%)`,
            filter: 'blur(60px)',
            opacity: 0.82
          }}
        ></div>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
