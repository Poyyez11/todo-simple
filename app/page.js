export const dynamic = 'force-dynamic';

import Redis from 'ioredis';
import { revalidatePath } from 'next/cache';

// Menghubungkan menggunakan environment variable dari Vercel Storage
const redis = new Redis(process.env.STORAGE_REDIS_URL);

export default async function Page() {
  // 1. Mengambil data list tugas dari database Redis
  const rawTodos = await redis.lrange('todo-list', 0, -1);
  const todos = rawTodos || [];

  // 2. Fungsi untuk menambah tugas baru (Server Action)
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
    <div style={{ padding: '30px', fontFamily: 'sans-serif' }}>
      <h2>TaskEdu - Todo List (Cloud Database)</h2>

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