export const dynamic = 'force-dynamic';

import Redis from 'ioredis';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

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

// Fungsi Hitung Status Deadline (Feature 1)
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
  const currentView = resolvedParams?.view || 'list'; // list, kanban, calendar, report
  const searchQuery = resolvedParams?.q?.toLowerCase() || '';
  const filterSubject = resolvedParams?.subject || 'all';

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
        if (storedPass) return;
        await dbClient.hset('users:map', username, password);
      } else {
        if (!storedPass || storedPass !== password) return;
      }

      const cStore = await cookies();
      cStore.set('task_tracker_user', username, { path: '/', maxAge: 60 * 60 * 24 * 7 });
      revalidatePath('/');
    }

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
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Username</label>
              <input type="text" name="username" placeholder="Username..." required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>Password</label>
              <input type="password" name="password" placeholder="Password..." required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '14px', background: 'linear-gradient(to right, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px' }}>
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

  // --- DASHBOARD UTAMA ---
  const redisKey = `todos:${currentUser}`;
  const rawTodos = await redis.lrange(redisKey, 0, -1);
  const todos = rawTodos.map((item, index) => parseTodoItem(item, index)).filter(Boolean);

  const taskToEdit = editId ? todos.find(t => t.id === editId) : null;

  // Daftar Mata Kuliah Unik untuk Filter (Feature 7)
  const subjectsList = [...new Set(todos.map(t => t.subject || 'Umum'))];

  // Filter & Search Logic (Feature 7)
  const filteredTodos = todos.filter(t => {
    const matchSearch = (t.name?.toLowerCase() || '').includes(searchQuery) || (t.description?.toLowerCase() || '').includes(searchQuery);
    const matchSubject = filterSubject === 'all' || (t.subject || 'Umum') === filterSubject;
    return matchSearch && matchSubject;
  });

  // Statistik
  const totalTugas = todos.length;
  const selesaiTugas = todos.filter(t => t.completed).length;
  const tugasUrgent = todos.filter(t => getDeadlineStatus(t.deadlineDate, t.deadlineTime).text.includes('Darurat') || getDeadlineStatus(t.deadlineDate, t.deadlineTime).text.includes('Terlambat')).length;
  const progressPersen = totalTugas > 0 ? Math.round((selesaiTugas / totalTugas) * 100) : 0;

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
    const subtasks = subtasksRaw.split('\n').map(s => s.trim()).filter(Boolean);

    const taskData = {
      id: idToEdit || Date.now().toString(),
      name: formData.get('name'),
      description: formData.get('description'),
      subject: formData.get('subject') || 'Umum',
      referenceLink: formData.get('referenceLink'),
      subtasks: subtasks,
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
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '20px 30px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ⚡ Task Tracker Pro
            </h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Workspace Privat: <strong style={{ color: '#38bdf8' }}>{currentUser}</strong>
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/?view=report" style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid #818cf8', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', color: '#818cf8', fontWeight: 'bold', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              📊 Laporan & Ekspor
            </a>
            <form action={handleLogout}>
              <button type="submit" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', color: '#f87171', fontWeight: 'bold', cursor: 'pointer' }}>
                Keluar
              </button>
            </form>
          </div>
        </header>

        {/* Statistik Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#94a3b8', fontSize: '13px' }}>Total Tugas</p>
            <h2 style={{ margin: 0, fontSize: '26px', color: '#fff' }}>{totalTugas}</h2>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#94a3b8', fontSize: '13px' }}>Tugas Urgent / Darurat</p>
            <h2 style={{ margin: 0, fontSize: '26px', color: '#f87171' }}>{tugasUrgent}</h2>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#94a3b8', fontSize: '13px' }}>Penyelesaian ({progressPersen}%)</p>
            <div style={{ width: '100%', background: '#334155', height: '8px', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPersen}%`, background: 'linear-gradient(to right, #4f46e5, #06b6d4)', height: '100%', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Feature 2) & Filters (Feature 7) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href="/?view=list" style={{ padding: '8px 16px', borderRadius: '8px', background: currentView === 'list' ? '#4f46e5' : 'rgba(255,255,255,0.05)', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
              📋 List View
            </a>
            <a href="/?view=kanban" style={{ padding: '8px 16px', borderRadius: '8px', background: currentView === 'kanban' ? '#4f46e5' : 'rgba(255,255,255,0.05)', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
              📌 Kanban Board
            </a>
            <a href="/?view=calendar" style={{ padding: '8px 16px', borderRadius: '8px', background: currentView === 'calendar' ? '#4f46e5' : 'rgba(255,255,255,0.05)', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
              📅 Calendar / Timeline
            </a>
          </div>

          {/* Search & Subject Filter (Feature 7) */}
          <form method="GET" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input type="hidden" name="view" value={currentView} />
            <input type="text" name="q" defaultValue={searchQuery} placeholder="Cari tugas..." style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '13px', outline: 'none' }} />
            <select name="subject" defaultValue={filterSubject} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', fontSize: '13px', outline: 'none' }}>
              <option value="all">Semua Mata Kuliah</option>
              {subjectsList.map(subj => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
            <button type="submit" style={{ padding: '8px 14px', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Filter</button>
          </form>
        </div>

        {/* View: Laporan / Report */}
        {currentView === 'report' ? (
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>📊 Laporan & Rekapitulasi Tugas</h3>
              <a href="/?view=list" style={{ padding: '8px 14px', background: '#475569', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '13px' }}>Kembali ke Daftar</a>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Ringkasan lengkap aktivitas tugas di workspace Anda:</p>
            <div style={{ display: 'grid', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '10px', fontSize: '14px' }}>
              <div>• Total Tugas Keseluruhan: <strong>{totalTugas}</strong></div>
              <div>• Tugas Selesai: <strong>{selesaiTugas}</strong></div>
              <div>• Tugas Belum Selesai: <strong>{totalTugas - selesaiTugas}</strong></div>
              <div>• Tugas Tingkat Darurat/Mendesak: <strong>{tugasUrgent}</strong></div>
            </div>
            <div style={{ marginTop: '25px' }}>
              <button onClick={() => window.print()} style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                🖨️ Cetak / Simpan PDF Laporan
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: currentView === 'list' ? '1fr 2fr' : '1fr', gap: '25px' }}>
            
            {/* Form Input / Edit (Hanya tampil di view list / kanban) */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '25px', borderRadius: '16px', height: 'fit-content' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#f1f5f9' }}>
                  {taskToEdit ? '✏️ Edit Tugas' : '✨ Tambah Tugas Baru'}
                </h3>
                {taskToEdit && (
                  <a href="/" style={{ fontSize: '11px', background: '#475569', color: '#fff', padding: '4px 8px', borderRadius: '6px', textDecoration: 'none' }}>Batal</a>
                )}
              </div>

              <form action={handleSaveTask} style={{ display: 'grid', gap: '12px' }}>
                <input type="hidden" name="editId" value={taskToEdit?.id || ''} />

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Nama Tugas</label>
                  <input type="text" name="name" defaultValue={taskToEdit?.name || ''} placeholder="Contoh: Tugas Web" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Mata Kuliah / Kategori (Feature 7)</label>
                  <input type="text" name="subject" defaultValue={taskToEdit?.subject || 'Umum'} placeholder="Contoh: Pemrograman Web" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Tautan Referensi / Link (Feature 3)</label>
                  <input type="url" name="referenceLink" defaultValue={taskToEdit?.referenceLink || ''} placeholder="https://docs.google.com/..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Sub-Tugas / Checklist (1 per baris) (Feature 4)</label>
                  <textarea name="subtasks" rows="2" defaultValue={taskToEdit?.subtasks ? taskToEdit.subtasks.join('\n') : ''} placeholder="Bab 1 Pendahuluan&#10;Bab 2 Pembahasan" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }}></textarea>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Deskripsi / Catatan</label>
                  <textarea name="description" rows="2" defaultValue={taskToEdit?.description || ''} placeholder="Catatan tugas..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }}></textarea>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Tgl Diberikan</label>
                    <input type="date" name="assignedDate" defaultValue={taskToEdit?.assignedDate || ''} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Tipe Kategori</label>
                    <select name="category" defaultValue={taskToEdit?.category || 'Individu'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', outline: 'none' }}>
                      <option value="Individu">👤 Individu</option>
                      <option value="Kelompok">👥 Kelompok</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Deadline Tgl</label>
                    <input type="date" name="deadlineDate" defaultValue={taskToEdit?.deadlineDate || ''} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Deadline Jam</label>
                    <input type="time" name="deadlineTime" defaultValue={taskToEdit?.deadlineTime || '23:59'} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#cbd5e1' }}>Prioritas</label>
                  <select name="priority" defaultValue={taskToEdit?.priority || '🔴 Darurat & Penting'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', outline: 'none' }}>
                    <option value="🔴 Darurat & Penting (High)">🔴 Darurat & Penting (High)</option>
                    <option value="🟡 Penting Tapi Santai (Medium)">🟡 Penting Tapi Santai (Medium)</option>
                    <option value="🟢 Opsional (Low)">🟢 Opsional (Low)</option>
                  </select>
                </div>

                <button type="submit" style={{ width: '100%', padding: '12px', background: taskToEdit ? '#059669' : 'linear-gradient(to right, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '5px' }}>
                  {taskToEdit ? 'Simpan Perubahan' : '🚀 Tambah Tugas'}
                </button>
              </form>
            </div>

            {/* Content Display based on View */}
            <div>
              {/* LIST VIEW */}
              {currentView === 'list' && (
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '25px', borderRadius: '16px' }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>📋 Daftar Tugas ({filteredTodos.length})</h3>
                  
                  {filteredTodos.length === 0 ? (
                    <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>Tidak ada tugas ditemukan.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                      {filteredTodos.map((task) => {
                        const dlStatus = getDeadlineStatus(task.deadlineDate, task.deadlineTime);
                        return (
                          <div key={task.id} style={{ padding: '18px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: task.completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(0, 0, 0, 0.2)', opacity: task.completed ? 0.75 : 1, display: 'grid', gap: '10px' }}>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                              <div>
                                <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', marginRight: '6px' }}>
                                  📚 {task.subject || 'Umum'}
                                </span>
                                <h4 style={{ margin: '6px 0 2px 0', fontSize: '16px', color: task.completed ? '#6ee7b7' : '#fff', textDecoration: task.completed ? 'line-through' : 'none' }}>
                                  {task.name}
                                </h4>
                              </div>

                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', background: dlStatus.bg, color: dlStatus.color, padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                  {dlStatus.text}
                                </span>
                                <span style={{ fontSize: '11px', background: task.category === 'Kelompok' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.08)', color: '#818cf8', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                  {task.category}
                                </span>
                              </div>
                            </div>

                            {task.description && <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>{task.description}</p>}

                            {/* Reference Link (Feature 3) */}
                            {task.referenceLink && (
                              <div>
                                <a href={task.referenceLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'underline' }}>
                                  🔗 Buka Tautan Referensi / Link Tugas
                                </a>
                              </div>
                            )}

                            {/* Subtasks / Checklist (Feature 4) */}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1' }}>Checklist Sub-Tugas:</p>
                                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#94a3b8' }}>
                                  {task.subtasks.map((sub, i) => (
                                    <li key={i}>{sub}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                ⏰ Deadline: <strong style={{ color: '#f87171' }}>{task.deadlineDate} ({task.deadlineTime})</strong>
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <form action={toggleStatus}>
                                  <input type="hidden" name="id" value={task.id} />
                                  <button type="submit" style={{ padding: '5px 10px', background: task.completed ? '#334155' : '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                    {task.completed ? '↩ Batal' : '✓ Selesai'}
                                  </button>
                                </form>
                                <a href={`/?edit=${task.id}`} style={{ padding: '5px 10px', background: '#d97706', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold' }}>Edit</a>
                                <form action={hapusTugas}>
                                  <input type="hidden" name="id" value={task.id} />
                                  <button type="submit" style={{ padding: '5px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Hapus</button>
                                </form>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* KANBAN BOARD VIEW (Feature 2) */}
              {currentView === 'kanban' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                  {['Belum Selesai', 'Selesai'].map((statusCol) => {
                    const isCompletedCol = statusCol === 'Selesai';
                    const colTasks = filteredTodos.filter(t => isCompletedCol ? t.completed : !t.completed);
                    return (
                      <div key={statusCol} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '15px' }}>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '15px', color: isCompletedCol ? '#34d399' : '#818cf8' }}>
                          {statusCol} ({colTasks.length})
                        </h4>
                        <div style={{ display: 'grid', gap: '10px' }}>
                          {colTasks.map(t => (
                            <div key={t.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ fontSize: '10px', color: '#38bdf8' }}>{t.subject}</span>
                              <h5 style={{ margin: '4px 0', fontSize: '14px', color: '#fff' }}>{t.name}</h5>
                              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#f87171' }}>Deadline: {t.deadlineDate}</p>
                              <a href={`/?edit=${t.id}`} style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'underline' }}>Edit Detail</a>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CALENDAR / TIMELINE VIEW (Feature 2) */}
              {currentView === 'calendar' && (
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '25px', borderRadius: '16px' }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>📅 Timeline Berdasarkan Tanggal Deadline</h3>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {filteredTodos.sort((a,b) => new Date(a.deadlineDate) - new Date(b.deadlineDate)).map(task => (
                      <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                          <strong style={{ color: '#38bdf8', fontSize: '13px', marginRight: '10px' }}>[{task.deadlineDate}]</strong>
                          <span style={{ color: '#fff', fontSize: '14px' }}>{task.name}</span>
                        </div>
                        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '6px' }}>{task.subject}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </div>
  );
}