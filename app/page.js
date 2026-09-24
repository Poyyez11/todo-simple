import { kv } from '@vercel/kv';
import { revalidatePath } from 'next/cache';

export default async function Page() {
  // 1. Mengambil data list tugas dari database Vercel KV
  // 'todo-list' adalah nama kuncinya. 0, -1 artinya mengambil semua urutan data.
  const todos = await kv.lrange('todo-list', 0, -1) || [];

  // 2. Fungsi untuk menambah data ke database (Server Action)
  async function tambahTugas(formData) {
    'use server';
    const tugasBaru = formData.get('tugas');
    
    if (tugasBaru) {
      await kv.rpush('todo-list', tugasBaru); // Menyimpan tugas baru ke paling bawah
      revalidatePath('/'); // Memuat ulang halaman otomatis
    }
  }

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif' }}>
      <h2>Todo List (Tersimpan di Cloud)</h2>

      {/* Form Input Data */}
      <form action={tambahTugas} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          name="tugas"
          placeholder="Ketik tugas baru..."
          required
          style={{ padding: '10px', width: '250px', marginRight: '10px' }}
        />
        <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Simpan Tugas
        </button>
      </form>

      {/* Menampilkan Data */}
      <ul>
        {todos.length === 0 ? (
          <p>Belum ada tugas, silakan tambahkan!</p>
        ) : (
          todos.map((tugas, index) => (
            <li key={index} style={{ marginBottom: '10px' }}>{tugas}</li>
          ))
        )}
      </ul>
    </div>
  );
}