import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { padPassword } from '../constants';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  Users, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Search,
  UserCog,
  Building2,
  Mail,
  Plus,
  Download,
  Upload,
  FileSpreadsheet,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AccountManagement = () => {
  const { isAdminUtama } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Form States
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'peserta',
    pac_name: ''
  });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'admin_utama' | 'admin_pac' | 'peserta'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    if (!isAdminUtama) return;

    const q = query(collection(db, 'users'), orderBy('created_at', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdminUtama]);

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`Role berhasil diperbarui menjadi ${newRole}`);
    } catch (error: any) {
      toast.error('Gagal memperbarui role: ' + error.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;
    
    try {
      await deleteDoc(doc(db, 'users', deleteConfirm.id));
      toast.success(`Akun ${deleteConfirm.name} berhasil dihapus dari database`);
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error('Gagal menghapus data akun: ' + error.message);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    let secondaryApp;
    try {
      // 1. Check if user already exists in Firestore first (by email)
      const q = query(collection(db, 'users'), where('email', '==', newUser.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // User exists in Firestore, just update the role and name "at will"
        const existingDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'users', existingDoc.id), {
          name: newUser.name,
          role: newUser.role,
          pac_name: newUser.role === 'admin_pac' ? newUser.pac_name : '',
          updated_at: new Date().toISOString()
        });
        toast.success(`Akun ${newUser.email} berhasil diperbarui dengan role ${newUser.role}`);
        setShowAddModal(false);
        setNewUser({ name: '', email: '', password: '', role: 'peserta', pac_name: '' });
        setIsSubmitting(false);
        return;
      }

      // 2. If not in Firestore, try to create in Auth
      const appName = `secondary-app-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        const finalPassword = padPassword(newUser.password || 'ansor123'); // Default password if empty
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          newUser.email, 
          finalPassword
        );
        
        // 3. Create Firestore Profile
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          pac_name: newUser.role === 'admin_pac' ? newUser.pac_name : '',
          created_at: new Date().toISOString()
        });
        
        toast.success(`Akun baru ${newUser.email} berhasil dibuat sebagai ${newUser.role}`);
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // This means user is in Auth but NOT in Firestore (ghost user)
          // We can't get the UID, so we'll create a record with a generated ID 
          // and hope they sync on next login, OR just inform the admin.
          // Actually, let's try to be "at will" and create a record anyway with a random ID
          // but that might cause issues. Better to inform that they need to login.
          toast.warning(`Email ${newUser.email} sudah ada di sistem autentikasi. Silakan minta pengguna untuk login agar data tersinkronisasi.`);
        } else {
          throw authError;
        }
      }

      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'peserta', pac_name: '' });
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal memproses akun: ' + error.message);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        name: editingUser.name,
        role: editingUser.role,
        pac_name: editingUser.role === 'admin_pac' ? editingUser.pac_name : '',
        updated_at: new Date().toISOString()
      });
      toast.success('Data akun berhasil diperbarui');
      setShowEditModal(false);
      setEditingUser(null);
    } catch (error: any) {
      toast.error('Gagal memperbarui akun: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const data = [
      { Nama: 'Contoh Nama', Email: 'contoh@email.com', Password: 'password123', Role: 'peserta', PAC: '' },
      { Nama: 'Admin PAC Contoh', Email: 'pac@email.com', Password: 'password123', Role: 'admin_pac', PAC: 'PAC Tasikmalaya' }
    ];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Akun");
    XLSX.writeFile(wb, "Template_Import_Akun_SIMAK.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let successCount = 0;
        let failCount = 0;

        for (const row of data) {
          const email = row.Email || row.email;
          const password = row.Password || row.password;
          const name = row.Nama || row.nama || row.Name || row.name;
          const role = row.Role || row.role || 'peserta';
          const pac_name = row.PAC || row.pac || '';

          if (!email || !password || !name) {
            failCount++;
            continue;
          }

          let secondaryApp;
          try {
            // Check if user already exists in Firestore first
            const q = query(collection(db, 'users'), where('email', '==', email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const existingDoc = querySnapshot.docs[0];
              await updateDoc(doc(db, 'users', existingDoc.id), {
                name: name,
                role: role,
                pac_name: role === 'admin_pac' ? pac_name : '',
              });
              successCount++;
              continue;
            }

            const appName = `import-app-${Date.now()}-${successCount}`;
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);
            
            const finalPassword = padPassword(password.toString());
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, finalPassword);
            
            try {
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                name: name,
                email: email,
                role: role,
                pac_name: role === 'admin_pac' ? pac_name : '',
                created_at: new Date().toISOString()
              });
            } catch (error: any) {
              handleFirestoreError(error, OperationType.WRITE, `users/${userCredential.user.uid}`);
            }
            
            successCount++;
          } catch (err: any) {
            console.error(`Failed to import ${email}:`, err);
            const reason = err.code === 'auth/email-already-in-use' ? 'Email sudah terdaftar' : err.message;
            console.warn(`Alasan kegagalan untuk ${email}: ${reason}`);
            failCount++;
          } finally {
            if (secondaryApp) await deleteApp(secondaryApp);
          }
        }

        toast.success(`Import selesai: ${successCount} berhasil, ${failCount} gagal`);
        setShowImportModal(false);
      } catch (error: any) {
        toast.error('Gagal memproses file Excel: ' + error.message);
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'all' || u.role === activeTab;
    return matchesSearch && matchesTab;
  });

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data akun...</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <UserCog className="w-8 h-8 text-green-600" />
            Kelola Akun Pengguna
          </h1>
          <p className="text-slate-500 mt-1">Manajemen hak akses dan role pengguna SIMAK.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Import Excel
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Tambah Manual
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            {[
              { id: 'all', label: 'Semua', icon: Users },
              { id: 'admin_utama', label: 'Admin Utama', icon: ShieldAlert },
              { id: 'admin_pac', label: 'Admin PAC', icon: ShieldCheck },
              { id: 'peserta', label: 'Peserta', icon: Shield }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-green-600' : 'text-slate-400'}`} />
                {tab.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                  activeTab === tab.id ? 'bg-green-50 text-green-600' : 'bg-slate-200 text-slate-500'
                }`}>
                  {tab.id === 'all' ? users.length : users.filter(u => u.role === tab.id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="relative max-w-md w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Pengguna</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">PAC (Khusus Admin PAC)</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <div className="font-bold text-slate-800">{u.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {u.email}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <select 
                        value={u.role}
                        onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                        className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border-none focus:ring-2 focus:ring-green-500/20 outline-none cursor-pointer ${
                          u.role === 'admin_utama' ? 'bg-red-100 text-red-700' : 
                          u.role === 'admin_pac' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <option value="peserta">Peserta</option>
                        <option value="admin_pac">Admin PAC</option>
                        <option value="admin_utama">Admin Utama</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {u.role === 'admin_pac' ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {u.pac_name || '-'}
                      </div>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingUser(u);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit Akun"
                      >
                        <UserCog className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ id: u.id, name: u.name })}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Hapus Akun"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex gap-4">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
        <div>
          <h3 className="font-bold text-amber-800">Perhatian Keamanan</h3>
          <p className="text-amber-700 text-sm mt-1">
            Mengubah role pengguna akan langsung memberikan atau mencabut hak akses mereka ke fitur-fitur tertentu. 
            Pastikan Anda memverifikasi identitas pengguna sebelum memberikan role Admin.
          </p>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-6 h-6 text-green-600" />
                  Tambah Akun Manual
                </h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleManualAdd} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Lengkap</label>
                  <input 
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder="Masukkan nama lengkap..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                  <input 
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder="Masukkan email..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      placeholder="Masukkan password..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Role</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                  >
                    <option value="peserta">Peserta</option>
                    <option value="admin_pac">Admin PAC</option>
                    <option value="admin_utama">Admin Utama</option>
                  </select>
                </div>
                {newUser.role === 'admin_pac' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama PAC</label>
                    <input 
                      type="text"
                      required
                      value={newUser.pac_name}
                      onChange={(e) => setNewUser({ ...newUser, pac_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      placeholder="Contoh: PAC Tasikmalaya"
                    />
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 transition-all disabled:opacity-50 mt-4"
                >
                  {isSubmitting ? 'Memproses...' : 'Tambah Akun'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {showEditModal && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowEditModal(false);
                setEditingUser(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <UserCog className="w-6 h-6 text-blue-600" />
                  Edit Akun Pengguna
                </h2>
                <button onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleEditUser} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Lengkap</label>
                  <input 
                    type="text"
                    required
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email (Tidak dapat diubah)</label>
                  <input 
                    type="email"
                    disabled
                    value={editingUser.email}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Role</label>
                  <select 
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="peserta">Peserta</option>
                    <option value="admin_pac">Admin PAC</option>
                    <option value="admin_utama">Admin Utama</option>
                  </select>
                </div>
                {editingUser.role === 'admin_pac' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama PAC</label>
                    <input 
                      type="text"
                      required
                      value={editingUser.pac_name}
                      onChange={(e) => setEditingUser({ ...editingUser, pac_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all disabled:opacity-50 mt-4"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Perubahan'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Upload className="w-6 h-6 text-blue-600" />
                  Import Akun dari Excel
                </h2>
                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col items-center text-center">
                  <FileSpreadsheet className="w-12 h-12 text-blue-600 mb-3" />
                  <h3 className="font-bold text-blue-900">Gunakan Template</h3>
                  <p className="text-sm text-blue-700 mt-1 mb-4">
                    Pastikan format file Excel Anda sesuai dengan template yang kami sediakan.
                  </p>
                  <button 
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 text-blue-700 font-bold text-sm hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Template Excel
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <input 
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleImportExcel}
                      disabled={importing}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label 
                      htmlFor="excel-upload"
                      className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                    >
                      <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mb-2" />
                      <span className="text-sm font-bold text-slate-600 group-hover:text-blue-700">
                        {importing ? 'Sedang mengimport...' : 'Pilih File Excel'}
                      </span>
                      <span className="text-xs text-slate-400 mt-1">Format: .xlsx atau .xls</span>
                    </label>
                  </div>
                </div>

                <div className="text-xs text-slate-400 italic">
                  * Proses import akan mendaftarkan akun ke sistem autentikasi dan membuat profil di database.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Hapus Akun?</h3>
              <p className="text-slate-500 text-center mb-8">
                Apakah Anda yakin ingin menghapus akun <span className="font-bold text-slate-900">{deleteConfirm.name}</span>? 
                Tindakan ini akan menghapus data profil dari database dan tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteUser}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-200 transition-all"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountManagement;
