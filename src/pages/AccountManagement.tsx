import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
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
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Form States
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'peserta',
    pac_name: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isAdminUtama) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun ${userName}? Data di Firestore akan dihapus.`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Data akun berhasil dihapus dari database');
    } catch (error: any) {
      toast.error('Gagal menghapus data akun: ' + error.message);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    let secondaryApp;
    try {
      // Create a secondary app to avoid logging out the admin
      const appName = `secondary-app-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      // 1. Create Auth Account
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newUser.email, 
        newUser.password
      );
      
      // 2. Create Firestore Profile
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        pac_name: newUser.role === 'admin_pac' ? newUser.pac_name : '',
        created_at: new Date().toISOString()
      });

      toast.success('Akun berhasil ditambahkan secara manual');
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'peserta', pac_name: '' });
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal menambahkan akun: ' + (error.code === 'auth/email-already-in-use' ? 'Email sudah terdaftar' : error.message));
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
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
            const appName = `import-app-${Date.now()}-${successCount}`;
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);
            
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              uid: userCredential.user.uid,
              name: name,
              email: email,
              role: role,
              pac_name: role === 'admin_pac' ? pac_name : '',
              created_at: new Date().toISOString()
            });
            
            successCount++;
          } catch (err) {
            console.error(`Failed to import ${email}:`, err);
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

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="p-6 border-b border-slate-50">
          <div className="relative max-w-md">
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
                    <button 
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Hapus Akun"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
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
    </div>
  );
};

export default AccountManagement;
