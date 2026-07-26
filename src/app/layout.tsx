import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Command Center',
  description: 'Your life, in one place.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#10140f',
              color: '#d8e4d0',
              border: '1px solid #1e2a1c',
            },
          }}
        />
      </body>
    </html>
  );
}
