export const metadata = {
  title: 'Task Tracker',
  description: 'Manajemen tugas kuliah dan proyek',
  manifest: '/manifest.json', 
  themeColor: '#0f172a',      
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}