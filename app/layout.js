import './globals.css'; // Sesuaikan jika Anda menggunakan css global

export const metadata = {
  title: 'Task Tracker Pro',
  description: 'Manajemen tugas kuliah dan proyek',
  manifest: '/manifest.json', // Ini menghubungkan manifest yang kita buat
  themeColor: '#0f172a',      // Mengubah warna atas (status bar) HP menjadi gelap
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