import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { 
  Users, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Search,
  UserCog,
  Building2,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AccountManagement = () => {
  const { isAdminUtama } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data akun...</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <UserCog className="w-8 h-8 text-green-600" />
          Kelola Akun Pengguna
        </h1>
        <p className="text-slate-500 mt-1">Manajemen hak akses dan role pengguna SIMAK.</p>
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
    </div>
  );
};

export default AccountManagement;
