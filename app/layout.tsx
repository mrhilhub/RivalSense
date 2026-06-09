import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RivalSense AI Market Intelligence',
  description: 'Search AI company changes, sources, and strategic insights.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
