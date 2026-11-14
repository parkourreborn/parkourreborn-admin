import type { Metadata } from 'next';
import { Exo_2, IBM_Plex_Mono, Jura, Rajdhani } from 'next/font/google';
import { AuthProvider } from '@/components/auth-provider';
import DashboardShell from '@/components/dashboard-shell';
import './globals.css';

// Same fonts as the main hub, self-hosted by next/font.
const exo2 = Exo_2({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700', '800'], variable: '--font-exo2', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-plex-mono', display: 'swap' });
const jura = Jura({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-jura', display: 'swap' });
const rajdhani = Rajdhani({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-rajdhani', display: 'swap' });
const fontVariables = [exo2.variable, plexMono.variable, jura.variable, rajdhani.variable].join(' ');

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: { default: 'PR Hub Admin', template: '%s | PR Hub Admin' },
  description: 'Internal controls for the Parkour Reborn Hub.',
  icons: { icon: '/logo/logo.ico' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${fontVariables}`}>
      <body>
        <div className="hub-bg" aria-hidden="true">
          <span className="hub-bg__icons" />
          <span className="hub-bg__shade" />
        </div>
        <AuthProvider>
          <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
      </body>
    </html>
  );
}
