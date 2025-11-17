import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Focal Deploy - Cloud Deployment Platform',
  description: 'Deploy and manage your cloud infrastructure with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
