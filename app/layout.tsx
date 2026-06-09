import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RivalSense Database Intelligence',
  description: 'Database intelligence for engineering and platform teams.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
