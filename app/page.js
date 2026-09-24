export const dynamic = 'force-dynamic';

import Redis from 'ioredis';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

const redis = new Redis(process.env.STORAGE_REDIS_URL);

// Fungsi pembantu parsing tugas
function parseTodoItem(item, index) {
  if (!item) return null;
  if (typeof item === 'object') return item;
  try {
    return JSON.parse(item);
  } catch {
    return {
      id: `legacy-${index}-${Date.now()}`,
      name: item,
      description: 'Tugas migrasi',
      assignedDate: new Date().toISOString().split('T')[0],
      deadlineDate: new Date().toISOString().split('T')[0],
      deadlineTime: '23:59',
      category: 'Individu',
      priority: '🟡 Penting Tapi Santai (Medium)',
      completed: false,
    };
  }
}

export default async function Page({ searchParams }) {
  const cookieStore = await cookies();
  const currentUser = cookieStore.get('task_tracker_user')?.value || null;
  
  const resolvedParams = await searchParams;
  const editId = resolvedParams?.edit;
  const authMode = resolvedParams?.auth || (currentUser ? 'dashboard' : 'login');

  // Jika belum login, tampilkan halaman Login / Register
  if (!currentUser) {
    async function handleAuth(formData) {
      'use server';
      const actionType = formData.get('actionType');
      const username = formData.get('username')?.trim();
      const password = formData.get('password')?.trim();

      if (!username || !password) return;

      const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
      const storedPass = await dbClient.hget('users:map', username);

      if (actionType === 'register') {
        if (storedPass) {
          // Username sudah ada
          return;
        }
        await dbClient.hset('users:map', username, password);
      } else {
        // Login
        if (!storedPass || storedPass !== password) {
          return;
        }
      }

      const cStore = await cookies();
      cStore.set('task_tracker_user', username, { path: '/', maxAge: 60 * 60 * 24 * 7 });
      revalidatePath('/');
    }

    const isRegister = authMode === 'register';

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '40px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ⚡ Task Tracker
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
              {isRegister ? 'Buat akun privat Anda' : 'Silakan masuk ke workspace Anda'}
            </p>
          </div>

          <form action={handleAuth} style={{ display: 'grid', gap: '15px' }}>
            <input type="hidden" name="actionType" value={isRegister ? 'register' : 'login'} />
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Username</label>
              <input type="text" name="username" placeholder="Masukkan username..." required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Password</label>
              <input type="password" name="password" placeholder="Masukkan password..." required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }} />
            </div>

            <button type="submit" style={{ width: '100%', padding: '14px', background: 'linear-gradient(to right, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)' }}>
              {isRegister ? 'Daftar Akun Baru' : 'Masuk Workspace'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '13px', color: '#94a3b8' }}>
            {isRegister ? (
              <span>Sudah punya akun? <a href="/" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 'bold' }}>Login di sini</a></span>
            ) : (
              <span>Belum punya akun? <a href="/?auth=register" style={{ color: '#c084fc', textDecoration: 'none', fontWeight: 'bold' }}>Daftar sekarang</a></span>
            )}
          </div>

        </div>
      </div>
    );
  }

  // --- DASHBOARD UTAMA (Sudah Login) ---
  const redisKey = `todos:${currentUser}`;
  const rawTodos = await redis.lrange(redisKey, 0, -1);
  const todos = rawTodos.map((item, index) => parseTodoItem(item, index)).filter(Boolean);

  const taskToEdit = editId ? todos.find(t => t.id === editId) : null;

  // Statistik
  const totalTugas = todos.length;
  const selesaiTugas = todos.filter(t => t.completed).length;
  const tugasKelompok = todos.filter(t => t.category === 'Kelompok').length;
  const tugasUrgent = todos.filter(t => t.priority?.includes('Darurat') || t.priority?.includes('Mendesak')).length;
  const progressPersen = totalTugas > 0 ? Math.round((selesaiTugas / totalTugas) * 100) : 0;

  // Server Action: Logout
  async function handleLogout() {
    'use server';
    const cStore = await cookies();
    cStore.set('task_tracker_user', '', { path: '/', maxAge: 0 });
    revalidatePath('/');
  }

  // Server Action: Simpan/Edit Tugas
  async function handleSaveTask(formData) {
    'use server';
    const cStore = await cookies();
    const user = cStore.get('task_tracker_user')?.value;
    if (!user) return;

    const idToEdit = formData.get('editId');
    const taskData = {
      id: idToEdit || Date.now().toString(),
      name: formData.get('name'),
      description: formData.get('description'),
      assignedDate: formData.get('assignedDate'),
      deadlineDate: formData.get('deadlineDate'),
      deadlineTime: formData.get('deadlineTime'),
      category: formData.get('category'),
      priority: formData.get('priority'),
      completed: formData.get('completed') === 'true',
    };

    if (taskData.name) {
      const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
      const key = `todos:${user}`;
      const currentRaw = await dbClient.lrange(key, 0, -1);
      let currentTodos = currentRaw.map((i, idx) => parseTodoItem(i, idx)).filter(Boolean);

      if (idToEdit) {
        currentTodos = currentTodos.map(t => t.id === idToEdit ? { ...taskData, completed: t.completed } : t);
      } else {
        currentTodos.push(taskData);
      }

      await dbClient.del(key);
      if (currentTodos.length > 0) {
        await dbClient.rpush(key, ...currentTodos.map(t => JSON.stringify(t)));
      }
      revalidatePath('/');
    }
  }

  // Server Action: Hapus Tugas
  async function hapusTugas(formData) {
    'use server';
    const cStore = await cookies();
    const user = cStore.get('task_tracker_user')?.value;
    if (!user) return;

    const idToDelete = formData.get('id');
    const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
    const key = `todos:${user}`;
    const currentRaw = await dbClient.lrange(key, 0, -1);
    const currentTodos = currentRaw.map((i, idx) => parseTodoItem(i, idx)).filter(Boolean).filter(t => t.id !== idToDelete);

    await dbClient.del(key);
    if (currentTodos.length > 0) {
      await dbClient.rpush(key, ...currentTodos.map(t => JSON.stringify(t)));
    }
    revalidatePath('/');
  }

  // Server Action: Toggle Selesai
  async function toggleStatus(formData) {
    'use server';
    const cStore = await cookies();
    const user = cStore.get('task_tracker_user')?.value;
    if (!user) return;

    const idToToggle = formData.get('id');
    const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
    const key = `todos:${user}`;
    const currentRaw = await dbClient.lrange(key, 0, -1);
    const currentTodos = currentRaw.map((i, idx) => parseTodoItem(i, idx)).filter(Boolean).map(t => {
      if (t.id === idToToggle) return { ...t, completed: !t.completed };
      return t;
    });

    await dbClient.del(key);
    if (currentTodos.length > 0) {
      await dbClient.rpush(key, ...currentTodos.map(t => JSON.stringify(t)));
    }
    revalidatePath('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '30px 20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header Navbar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '20px 30px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ⚡ Task Tracker
            </h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Workspace Privat: <strong style={{ color: '#38bdf8' }}>{currentUser}</strong>
            </p>
          </div>
          
          <form action={handleLogout}>
            <button type="submit" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', color: '#f87171', fontWeight: 'bold', cursor: 'pointer' }}>
              Keluar (Logout)
            </button>
          </form>
        </header>

        {/* Statistik & Progres Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#94a3b8', fontSize: '13px' }}>Total Tugas</p>
            <h2 style={{ margin: 0, fontSize: '28px', color: '#fff' }}>{totalTugas}</h2>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#94a3b8', fontSize: '13px' }}>Tugas Kelompok</p>
            <h2 style={{ margin: 0, fontSize: '28px', color: '#818cf8' }}>{tugasKelompok}</h2>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#94a3b8', fontSize: '13px' }}>Prioritas Mendesak</p>
            <h2 style={{ margin: 0, fontSize: '28px', color: '#f87171' }}>{tugasUrgent}</h2>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#94a3b8', fontSize: '13px' }}>Penyelesaian ({progressPersen}%)</p>
            <div style={{ width: '100%', background: '#334155', height: '8px', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPersen}%`, background: 'linear-gradient(to right, #4f46e5, #06b6d4)', height: '100%', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        </div>

        {/* Form Input / Edit Card */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '16px', marginBottom: '35px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#f1f5f9' }}>
              {taskToEdit ? '✏️ Edit Tugas Kuliah' : '✨ Tambah Tugas Baru'}
            </h3>
            {taskToEdit && (
              <a href="/" style={{ fontSize: '12px', background: '#475569', color: '#fff', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
                Batal Edit
              </a>
            )}
          </div>

          <form action={handleSaveTask} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <input type="hidden" name="editId" value={taskToEdit?.id || ''} />

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Nama Tugas</label>
              <input type="text" name="name" defaultValue={taskToEdit?.name || ''} placeholder="Contoh: Tugas Besar Web Programming" required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Deskripsi / Catatan Detail</label>
              <textarea name="description" rows="2" defaultValue={taskToEdit?.description || ''} placeholder="Tautan meeting, pembagian tugas kelompok, atau instruksi dosen..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }}></textarea>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Tanggal Diberikan</label>
              <input type="date" name="assignedDate" defaultValue={taskToEdit?.assignedDate || ''} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Kategori Tugas</label>
              <select name="category" defaultValue={taskToEdit?.category || 'Individu'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', outline: 'none' }}>
                <option value="Individu">👤 Individu</option>
                <option value="Kelompok">👥 Kelompok</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Deadline Tanggal</label>
              <input type="date" name="deadlineDate" defaultValue={taskToEdit?.deadlineDate || ''} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Deadline Jam</label>
              <input type="time" name="deadlineTime" defaultValue={taskToEdit?.deadlineTime || ''} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Tingkat Prioritas & Urgensi</label>
              <select name="priority" defaultValue={taskToEdit?.priority || '🔴 Darurat & Penting'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', outline: 'none' }}>
                <option value="🔴 Darurat & Penting (High Urgency)">🔴 Darurat & Penting (High Urgency)</option>
                <option value="🟡 Penting Tapi Santai (Medium)">🟡 Penting Tapi Santai (Medium)</option>
                <option value="🟢 Bisa Ditunda / Opsional (Low)">🟢 Bisa Ditunda / Opsional (Low)</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
              <button type="submit" style={{ width: '100%', padding: '14px', background: taskToEdit ? '#059669' : 'linear-gradient(to right, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)' }}>
                {taskToEdit ? 'Simpan Perubahan Tugas' : '🚀 Tambahkan Tugas ke Cloud'}
              </button>
            </div>
          </form>
        </div>

        {/* Daftar Tugas List */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#f1f5f9' }}>📋 Daftar Seluruh Tugas Anda</h3>
          
          {todos.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>Belum ada tugas tersimpan di workspace Anda. Silakan buat tugas di atas!</p>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {todos.map((task) => (
                <div key={task.id} style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: task.completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px', opacity: task.completed ? 0.75 : 1, transition: 'all 0.2s' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '17px', color: task.completed ? '#6ee7b7' : '#fff', textDecoration: task.completed ? 'line-through' : 'none' }}>
                        {task.name}
                      </h4>
                    </div>
                    
                    {/* Badge Category & Priority */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: task.category === 'Kelompok' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.08)', color: task.category === 'Kelompok' ? '#818cf8' : '#cbd5e1', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {task.category}
                      </span>
                      <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        {task.priority}
                      </span>
                    </div>
                  </div>

                  {task.description && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>{task.description}</p>
                  )}

                  {/* Footer Card: Info & Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#94a3b8' }}>
                      <span>📅 Diberikan: <strong style={{ color: '#e2e8f0' }}>{task.assignedDate || '-'}</strong></span>
                      <span>⏰ Deadline: <strong style={{ color: '#f87171' }}>{task.deadlineDate} ({task.deadlineTime})</strong></span>
                    </div>

                    {/* Tombol Aksi (Selesai, Edit, Hapus) */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Selesai / Belum */}
                      <form action={toggleStatus}>
                        <input type="hidden" name="id" value={task.id} />
                        <button type="submit" style={{ padding: '6px 12px', background: task.completed ? '#334155' : '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                          {task.completed ? '↩ Batalkan' : '✓ Selesai'}
                        </button>
                      </form>

                      {/* Tombol Edit */}
                      <a href={`/?edit=${task.id}`} style={{ padding: '6px 12px', background: '#d97706', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>
                        Edit
                      </a>

                      {/* Tombol Hapus */}
                      <form action={hapusTugas}>
                        <input type="hidden" name="id" value={task.id} />
                        <button type="submit" style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                          Hapus
                        </button>
                      </form>
                    </div>

                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}