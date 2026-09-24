'use client';

export default function PrintButton() {
  const handlePrint = () => {
    // Membuka dialog print bawaan browser, pengguna tinggal memilih "Save as PDF" / "Simpan sebagai PDF"
    window.print();
  };

  return (
    <button 
      onClick={handlePrint} 
      style={{ 
        padding: '10px 20px', 
        background: '#4f46e5', 
        color: '#fff', 
        border: 'none', 
        borderRadius: '8px', 
        fontWeight: 'bold', 
        cursor: 'pointer' 
      }}
    >
      🖨️ Cetak / Simpan PDF Laporan
    </button>
  );
}