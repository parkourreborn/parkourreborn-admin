import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import DashboardShell from '@/components/dashboard-shell';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: { default: 'PR Hub Admin', template: '%s | PR Hub Admin' },
  description: 'Internal controls for the Parkour Reborn Hub.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
      </body>
    </html>
  );
}
