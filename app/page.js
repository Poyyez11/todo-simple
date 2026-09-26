export const dynamic = 'force-dynamic';

import Redis from 'ioredis';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import PrintButton from './PrintButton'; // Mengimpor Client Component

const redis = new Redis(process.env.STORAGE_REDIS_URL);

// Fungsi pembantu parsing tugas yang aman
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
      subject: 'Umum',
      referenceLink: '',
      subtasks: [],
      assignedDate: new Date().toISOString().split('T')[0],
      deadlineDate: new Date().toISOString().split('T')[0],
      deadlineTime: '23:59',
      category: 'Individu',
      priority: '🟡 Penting Tapi Santai (Medium)',
      completed: false,
    };
  }
}

// Fungsi Hitung Status Deadline
function getDeadlineStatus(deadlineDate, deadlineTime) {
  if (!deadlineDate) return { text: 'Normal', color: '#94a3b8', bg: 'rgba(255,255,255,0.08)' };
  const target = new Date(`${deadlineDate}T${deadlineTime || '23:59'}`);
  const now = new Date();
  const diffHours = (target - now) / (1000 * 60 * 60);

  if (diffHours < 0) return { text: '⚠️ Terlambat (Overdue)', color: '#f87171', bg: 'rgba(239, 68, 68, 0.2)' };
  if (diffHours <= 24) return { text: '🔴 Darurat (< 24 Jam)', color: '#f87171', bg: 'rgba(239, 68, 68, 0.2)' };
  if (diffHours <= 72) return { text: '🟡 1-3 Hari Lagi', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
  return { text: '🟢 Aman (> 3 Hari)', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' };
}

export default async function Page({ searchParams }) {
  const cookieStore = await cookies();
  const currentUser = cookieStore.get('task_tracker_user')?.value || null;
  
  const resolvedParams = await searchParams;
  const editId = resolvedParams?.edit;
  const currentView = resolvedParams?.view || 'list';
  const searchQuery = resolvedParams?.q?.toLowerCase() || '';
  const filterSubject = resolvedParams?.subject || 'all';

  // Autentikasi
  if (!currentUser) {
    const isRegister = resolvedParams?.auth === 'register';

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '40px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ⚡ Task Tracker Pro
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
              {isRegister ? 'Buat akun privat Anda' : 'Masuk ke workspace Anda'}
            </p>
          </div>

          <form action={handleAuth} style={{ display: 'grid', gap: '15px' }}>
            <input type="hidden" name="actionType" value={isRegister ? 'register' : 'login'} />
            <div>
              <label style={{ color: '#cbd5e1', fontSize: '12px' }}>Username</label>
              <input type="text" name="username" required style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
            </div>
            <div>
              <label style={{ color: '#cbd5e1', fontSize: '12px' }}>Password</label>
              <input type="password" name="password" required style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
            </div>
            <button type="submit" style={{ padding: '14px', background: 'linear-gradient(to right, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isRegister ? 'Daftar' : 'Masuk'}
            </button>
          </form>
          
          {/* Tombol bolak-balik Login/Register */}
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
             {isRegister ? (
               <a href="/" style={{ color: '#818cf8', textDecoration: 'none' }}>Sudah punya akun? Login di sini</a>
             ) : (
               <a href="/?auth=register" style={{ color: '#818cf8', textDecoration: 'none' }}>Belum punya akun? Daftar di sini</a>
             )}
          </div>
        </div>
      </div>
    );
              <label style={{ color: '#cbd5e1', fontSize: '12px' }}>Password</label>
              <input type="password" name="password" required style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
            </div>
            <button type="submit" style={{ padding: '14px', background: 'linear-gradient(to right, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isRegister ? 'Daftar' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Pengambilan Data
  const redisKey = `todos:${currentUser}`;
  const rawTodos = await redis.lrange(redisKey, 0, -1);
  const todos = rawTodos.map((item, index) => parseTodoItem(item, index)).filter(Boolean);
  const taskToEdit = editId ? todos.find(t => t.id === editId) : null;
  const subjectsList = [...new Set(todos.map(t => t.subject || 'Umum'))];

  // Filter
  const filteredTodos = todos.filter(t => {
    const matchSearch = (t.name?.toLowerCase() || '').includes(searchQuery) || (t.description?.toLowerCase() || '').includes(searchQuery);
    const matchSubject = filterSubject === 'all' || (t.subject || 'Umum') === filterSubject;
    return matchSearch && matchSubject;
  });

  // Statistik
  const totalTugas = todos.length;
  const selesaiTugas = todos.filter(t => t.completed).length;
  const tugasUrgent = todos.filter(t => getDeadlineStatus(t.deadlineDate, t.deadlineTime).text.includes('Darurat') || getDeadlineStatus(t.deadlineDate, t.deadlineTime).text.includes('Terlambat')).length;

  // Server Actions
  async function handleLogout() {
    'use server';
    const cStore = await cookies();
    cStore.set('task_tracker_user', '', { path: '/', maxAge: 0 });
    revalidatePath('/');
  }

  async function handleSaveTask(formData) {
    'use server';
    const cStore = await cookies();
    const user = cStore.get('task_tracker_user')?.value;
    if (!user) return;

    const idToEdit = formData.get('editId');
    const subtasksRaw = formData.get('subtasks') || '';
    const taskData = {
      id: idToEdit || Date.now().toString(),
      name: formData.get('name'),
      description: formData.get('description'),
      subject: formData.get('subject') || 'Umum',
      referenceLink: formData.get('referenceLink'),
      subtasks: subtasksRaw.split('\n').map(s => s.trim()).filter(Boolean),
      assignedDate: formData.get('assignedDate'),
      deadlineDate: formData.get('deadlineDate'),
      deadlineTime: formData.get('deadlineTime'),
      category: formData.get('category'),
      priority: formData.get('priority'),
      completed: false,
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
      if (currentTodos.length > 0) await dbClient.rpush(key, ...currentTodos.map(t => JSON.stringify(t)));
      revalidatePath('/');
    }
  }

  async function hapusTugas(formData) {
    'use server';
    const cStore = await cookies();
    const user = cStore.get('task_tracker_user')?.value;
    const idToDelete = formData.get('id');
    const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
    const key = `todos:${user}`;
    const currentTodos = (await dbClient.lrange(key, 0, -1)).map((i, idx) => parseTodoItem(i, idx)).filter(Boolean).filter(t => t.id !== idToDelete);
    await dbClient.del(key);
    if (currentTodos.length > 0) await dbClient.rpush(key, ...currentTodos.map(t => JSON.stringify(t)));
    revalidatePath('/');
  }

  async function toggleStatus(formData) {
    'use server';
    const cStore = await cookies();
    const user = cStore.get('task_tracker_user')?.value;
    const idToToggle = formData.get('id');
    const dbClient = new Redis(process.env.STORAGE_REDIS_URL);
    const key = `todos:${user}`;
    const currentTodos = (await dbClient.lrange(key, 0, -1)).map((i, idx) => parseTodoItem(i, idx)).filter(Boolean).map(t => t.id === idToToggle ? { ...t, completed: !t.completed } : t);
    await dbClient.del(key);
    if (currentTodos.length > 0) await dbClient.rpush(key, ...currentTodos.map(t => JSON.stringify(t)));
    revalidatePath('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '30px 20px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'rgba(255,255,255,0.05)', padding: '20px 30px', borderRadius: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#818cf8' }}>⚡ Task Tracker Pro</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/?view=report" style={{ background: '#3730a3', padding: '8px 16px', borderRadius: '10px', color: '#fff', textDecoration: 'none' }}>📊 Laporan</a>
            <form action={handleLogout}>
              <button type="submit" style={{ background: '#991b1b', padding: '8px 16px', borderRadius: '10px', color: '#fff', border: 'none', cursor: 'pointer' }}>Keluar</button>
            </form>
          </div>
        </header>

        {/* View: Laporan / Report */}
        {currentView === 'report' ? (
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '30px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>📊 Laporan Tugas</h3>
              <a href="/?view=list" style={{ padding: '8px 14px', background: '#475569', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>Kembali</a>
            </div>
            <div style={{ display: 'grid', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '10px' }}>
              <div>• Total Tugas: <strong>{totalTugas}</strong></div>
              <div>• Selesai: <strong>{selesaiTugas}</strong></div>
              <div>• Mendesak: <strong>{tugasUrgent}</strong></div>
            </div>
            <div style={{ marginTop: '25px' }}>
              {/* Komponen Client untuk Cetak PDF */}
              <PrintButton /> 
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: currentView === 'list' ? '1fr 2fr' : '1fr', gap: '25px' }}>
            
            {/* Form Input */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '25px', borderRadius: '16px', height: 'fit-content' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>{taskToEdit ? '✏️ Edit Tugas' : '✨ Tambah Tugas'}</h3>
              <form action={handleSaveTask} style={{ display: 'grid', gap: '12px' }}>
                <input type="hidden" name="editId" value={taskToEdit?.id || ''} />
                <input type="text" name="name" defaultValue={taskToEdit?.name || ''} placeholder="Nama Tugas..." required style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid #334155' }} />
                <input type="text" name="subject" defaultValue={taskToEdit?.subject || 'Umum'} placeholder="Mata Kuliah..." required style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid #334155' }} />
                <textarea name="subtasks" rows="2" defaultValue={taskToEdit?.subtasks?.join('\n') || ''} placeholder="Sub-tugas (1 per baris)" style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid #334155' }}></textarea>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="date" name="deadlineDate" defaultValue={taskToEdit?.deadlineDate || ''} required style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid #334155' }} />
                  <input type="time" name="deadlineTime" defaultValue={taskToEdit?.deadlineTime || '23:59'} required style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid #334155' }} />
                </div>
                <button type="submit" style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Simpan Tugas</button>
              </form>
            </div>

            {/* List View */}
            {currentView === 'list' && (
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '25px', borderRadius: '16px' }}>
                <h3 style={{ margin: '0 0 20px 0' }}>📋 Daftar Tugas</h3>
                <div style={{ display: 'grid', gap: '15px' }}>
                  {filteredTodos.map((task) => {
                    const dlStatus = getDeadlineStatus(task.deadlineDate, task.deadlineTime);
                    const isUrgent = dlStatus.text.includes('Darurat') || dlStatus.text.includes('Terlambat');
                    
                    // Format Pesan WhatsApp
                    const waText = encodeURIComponent(`⚠️ *PENGINGAT TUGAS MENDESAK!* ⚠️\n\nMata Kuliah: ${task.subject}\nTugas: ${task.name}\nDeadline: ${task.deadlineDate} Jam ${task.deadlineTime}\n\nMohon segera diselesaikan ya!`);
                    const waLink = `https://wa.me/?text=${waText}`;

                    return (
                      <div key={task.id} style={{ padding: '18px', borderRadius: '12px', background: task.completed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.2)', border: '1px solid #334155' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <h4 style={{ margin: '0 0 10px 0', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.name} ({task.subject})</h4>
                          <span style={{ fontSize: '11px', background: dlStatus.bg, color: dlStatus.color, padding: '4px 8px', borderRadius: '6px' }}>{dlStatus.text}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                          <form action={toggleStatus}>
                            <input type="hidden" name="id" value={task.id} />
                            <button type="submit" style={{ padding: '6px 12px', background: task.completed ? '#334155' : '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                              {task.completed ? 'Batal' : '✓ Selesai'}
                            </button>
                          </form>
                          
                          {/* Tombol Pengingat WhatsApp akan muncul jika tugas mendesak & belum selesai */}
                          {isUrgent && !task.completed && (
                            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', background: '#25D366', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                              💬 Ingatkan via WA
                            </a>
                          )}

                          <form action={hapusTugas}>
                            <input type="hidden" name="id" value={task.id} />
                            <button type="submit" style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Hapus</button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}