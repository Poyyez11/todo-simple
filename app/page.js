export const dynamic = 'force-dynamic';

import Redis from 'ioredis';
import { revalidatePath } from 'next/cache';

const redis = new Redis(process.env.STORAGE_REDIS_URL);

export default async function Page() {
  // 1. Mengambil data tugas dari Redis dan mengubahnya dari JSON string ke Object
  const rawTodos = await redis.lrange('todo-list', 0, -1);
  const todos = rawTodos.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return { name: item, description: '-', category: 'Individu', priority: 'Normal' }; // fallback untuk data lama
    }
  });

  const totalTugas = todos.length;
  const tugasKelompok = todos.filter(t => t.category === 'Kelompok').length;
  const tugasUrgent = todos.filter(t => t.priority?.includes('Mendesak') || t.priority?.includes('Darurat')).length;

  // 2. Fungsi Server Action untuk menambah tugas dengan fitur lengkap
  async function tambahTugas(formData) {
    'use server';
    
    const newTask = {
      id: Date.now().toString(),
      name: formData.get('name'),
      description: formData.get('description'),
      assignedDate: formData.get('assignedDate'),
      deadlineDate: formData.get('deadlineDate'),
      deadlineTime: formData.get('deadlineTime'),
      category: formData.get('category'),
      priority: formData.get('priority'),
    };
    
    if (newTask.name) {
      const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
      await dbClient.rpush('todo-list', JSON.stringify(newTask));
      revalidatePath('/');
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', padding: '20px 40px' }}>
      {/* Header Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: '#fff', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#1e293b' }}>🎓 TaskEdu Pro</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Kuliah Task Manager Cloud Database</p>
        </div>
      </header>

      {/* Statistik Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '14px' }}>Total Tugas</p>
          <h2 style={{ margin: 0, color: '#0f172a' }}>{totalTugas}</h2>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '14px' }}>Tugas Kelompok</p>
          <h2 style={{ margin: 0, color: '#4f46e5' }}>{tugasKelompok}</h2>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '14px' }}>Prioritas Mendesak</p>
          <h2 style={{ margin: 0, color: '#ef4444' }}>{tugasUrgent}</h2>
        </div>
      </div>

      {/* Form Input Tugas Powerful */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>✨ Tambah Tugas Baru</h3>
        <form action={tambahTugas} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Nama Tugas</label>
            <input type="text" name="name" placeholder="Contoh: Membuat Laporan Praktikum" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Deskripsi Tugas</label>
            <textarea name="description" rows="2" placeholder="Catatan detail atau langkah pengerjaan tugas..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}></textarea>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Tanggal Diberikan</label>
            <input type="date" name="assignedDate" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Kategori Tugas</label>
            <select name="category" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}>
              <option value="Individu">👤 Individu</option>
              <option value="Kelompok">👥 Kelompok</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Deadline Tanggal</label>
            <input type="date" name="deadlineDate" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Deadline Jam</label>
            <input type="time" name="deadlineTime" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Prioritas (Berdasarkan Urgensi & Deadline)</label>
            <select name="priority" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}>
              <option value="🔴 Darurat & Penting (High Urgency)">🔴 Darurat & Penting (High Urgency)</option>
              <option value="🟡 Penting Tapi Santai (Medium)">🟡 Penting Tapi Santai (Medium)</option>
              <option value="🟢 Bisa Ditunda / Opsional (Low)">🟢 Bisa Ditunda / Opsional (Low)</option>
            </select>
          </div>

          <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
              Simpan Tugas ke Cloud
            </button>
          </div>
        </form>
      </div>

      {/* Daftar Tugas */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>📋 Daftar Tugas Kuliah</h3>
        {todos.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>Belum ada catatan tugas yang ditemukan.</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {todos.map((task, index) => (
              <div key={index} style={{ padding: '15px 20px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{task.name}</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '11px', background: task.category === 'Kelompok' ? '#e0e7ff' : '#f1f5f9', color: task.category === 'Kelompok' ? '#4338ca' : '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                      {task.category}
                    </span>
                    <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                      {task.priority}
                    </span>
                  </div>
                </div>

                {task.description && (
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{task.description}</p>
                )}

                <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#64748b', marginTop: '5px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                  <span>📅 Diberikan: <strong>{task.assignedDate || '-'}</strong></span>
                  <span>⏰ Deadline: <strong style={{ color: '#dc2626' }}>{task.deadlineDate} ({task.deadlineTime})</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}