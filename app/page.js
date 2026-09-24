export const dynamic = 'force-dynamic';

import Redis from 'ioredis';
import { revalidatePath } from 'next/cache';

const redis = new Redis(process.env.STORAGE_REDIS_URL);

export default async function Page() {
  // 1. Mengambil data tugas dari Redis
  const rawTodos = await redis.lrange('todo-list', 0, -1);
  const todos = rawTodos || [];

  const totalTugas = todos.length;

  // 2. Fungsi Server Action untuk menambah tugas
  async function tambahTugas(formData) {
    'use server';
    const tugasBaru = formData.get('tugas');
    
    if (tugasBaru) {
      const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
      await dbClient.rpush('todo-list', tugasBaru);
      revalidatePath('/');
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', padding: '20px 40px' }}>
      {/* Header Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#fff', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#1e293b' }}>🎓 TaskEdu</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Kuliah Task Manager Pro (Cloud Connected)</p>
        </div>
      </header>

      {/* Statistik Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '14px' }}>Total Tugas</p>
          <h2 style={{ margin: 0, color: '#0f172a' }}>{totalTugas}</h2>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '14px' }}>Status Cloud</p>
          <h2 style={{ margin: 0, color: '#10b981', fontSize: '18px' }}>Terhubung 🟢</h2>
        </div>
      </div>

      {/* Form Input Tugas */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1e293b' }}>Tambah Tugas Baru</h3>
        <form action={tambahTugas} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            name="tugas"
            placeholder="Masukkan judul tugas kuliah..."
            required
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
          />
          <button type="submit" style={{ padding: '12px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Simpan Tugas
          </button>
        </form>
      </div>

      {/* Daftar Tugas */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1e293b' }}>Daftar Tugas Anda</h3>
        {todos.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>Belum ada catatan tugas yang ditemukan.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {todos.map((tugas, index) => (
              <li key={index} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#334155' }}>{tugas}</span>
                <span style={{ fontSize: '12px', background: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: '6px' }}>Aktif</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}