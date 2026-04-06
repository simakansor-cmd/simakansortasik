import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { 
  Building2, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MoreVertical, 
  Trash2, 
  Edit3,
  Calendar,
  MapPin,
  ChevronRight,
  BookOpen,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const KaderisasiManagement = () => {
  const { profile, isAdminUtama, isAdminPAC } = useAuth();
  const [kaderisasiList, setKaderisasiList] = useState<any[]>([]);
  const [materiList, setMateriList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMateriModal, setShowMateriModal] = useState(false);
  const [newMateri, setNewMateri] = useState({ nama: '', kaderisasi_type: 'PKD' });

  useEffect(() => {
    if (!profile) return;

    let q;
    if (isAdminUtama) {
      q = query(collection(db, 'kaderisasi'));
    } else {
      q = query(collection(db, 'kaderisasi'), where('created_by', '==', profile.uid));
    }

    const unsubscribeKaderisasi = onSnapshot(q, (snapshot) => {
      setKaderisasiList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubscribeMateri = onSnapshot(collection(db, 'materi'), (snapshot) => {
      setMateriList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeKaderisasi();
      unsubscribeMateri();
    };
  }, [profile, isAdminUtama]);

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'kaderisasi', id), { status });
      toast.success(`Kegiatan ${status === 'approved' ? 'disetujui' : 'ditolak'}`);
    } catch (error: any) {
      toast.error('Gagal memperbarui status: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus kegiatan ini?')) return;
    try {
      await deleteDoc(doc(db, 'kaderisasi', id));
      toast.success('Kegiatan berhasil dihapus');
    } catch (error: any) {
      toast.error('Gagal menghapus: ' + error.message);
    }
  };

  const handleAddMateri = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'materi'), newMateri);
      setNewMateri({ ...newMateri, nama: '' });
      toast.success('Materi berhasil ditambahkan');
    } catch (error: any) {
      toast.error('Gagal menambahkan materi: ' + error.message);
    }
  };

  const handleDeleteMateri = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'materi', id));
      toast.success('Materi berhasil dihapus');
    } catch (error: any) {
      toast.error('Gagal menghapus materi: ' + error.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data...</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manajemen Kaderisasi</h1>
          <p className="text-slate-500 mt-1">Kelola pengajuan dan pelaksanaan kaderisasi.</p>
        </div>
        <div className="flex gap-3">
          {isAdminUtama && (
            <button 
              onClick={() => setShowMateriModal(true)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Kelola Materi
            </button>
          )}
          {isAdminPAC && (
            <Link 
              to="/kaderisasi/new" 
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Ajukan Baru
            </Link>
          )}
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Kegiatan</th>
                <th className="px-6 py-4">PAC Pengaju</th>
                <th className="px-6 py-4">Waktu & Lokasi</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {kaderisasiList.length > 0 ? kaderisasiList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                        item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.jenis.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{item.nama}</div>
                        <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">{item.jenis}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {item.pac_name}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <div className="text-sm text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {format(new Date(item.tanggal), 'dd MMM yyyy', { locale: id })}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {item.lokasi}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAdminUtama && item.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleStatusUpdate(item.id, 'approved')}
                            className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                            title="Setujui"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleStatusUpdate(item.id, 'rejected')}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                            title="Tolak"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      <Link 
                        to={`/participants/${item.id}`}
                        className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                        title="Lihat Peserta"
                      >
                        <Users className="w-5 h-5" />
                      </Link>
                      {isAdminUtama && (
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                          title="Hapus"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Belum ada data kaderisasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Materi Modal */}
      <AnimatePresence>
        {showMateriModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMateriModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-green-600" />
                  Manajemen Materi
                </h2>
                <button onClick={() => setShowMateriModal(false)} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <form onSubmit={handleAddMateri} className="flex gap-3">
                  <select 
                    value={newMateri.kaderisasi_type}
                    onChange={(e) => setNewMateri({ ...newMateri, kaderisasi_type: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                  >
                    <option value="PKD">PKD</option>
                    <option value="PKL">PKL</option>
                    <option value="Dirosah Ula">Dirosah Ula</option>
                    <option value="Dirosah Tsani">Dirosah Tsani</option>
                  </select>
                  <input 
                    type="text"
                    required
                    value={newMateri.nama}
                    onChange={(e) => setNewMateri({ ...newMateri, nama: e.target.value })}
                    placeholder="Nama Materi Baru..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                  />
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-700 transition-all">
                    Tambah
                  </button>
                </form>

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                  {['PKD', 'PKL', 'Dirosah Ula', 'Dirosah Tsani'].map((type) => (
                    <div key={type} className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2">{type}</h3>
                      {materiList.filter(m => m.kaderisasi_type === type).map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                          <span className="text-sm font-medium text-slate-700">{m.nama}</span>
                          <button 
                            onClick={() => handleDeleteMateri(m.id)}
                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {materiList.filter(m => m.kaderisasi_type === type).length === 0 && (
                        <div className="text-xs text-slate-400 italic p-2">Belum ada materi.</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KaderisasiManagement;
