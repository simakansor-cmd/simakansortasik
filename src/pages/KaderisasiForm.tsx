import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Building2, 
  Calendar, 
  MapPin, 
  ArrowLeft, 
  CheckCircle2,
  FileText,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

const KaderisasiForm = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    jenis: 'PKD',
    tanggal: '',
    lokasi: '',
    deskripsi: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'kaderisasi'), {
        ...formData,
        status: 'pending',
        created_by: profile.uid,
        pac_name: profile.pac_name || 'PAC Unknown',
        created_at: new Date().toISOString()
      });
      
      toast.success('Pengajuan kaderisasi berhasil dikirim!');
      navigate('/kaderisasi');
    } catch (error: any) {
      toast.error('Gagal mengirim pengajuan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ajukan Kaderisasi</h1>
          <p className="text-slate-500 mt-1">Isi formulir untuk mengajukan pelaksanaan kaderisasi baru.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Nama Kegiatan</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                  placeholder="Contoh: PKD PAC Cihideung Angkatan I"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Jenis Kaderisasi</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  required
                  value={formData.jenis}
                  onChange={(e) => setFormData({ ...formData, jenis: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none"
                >
                  <option value="PKD">PKD (Pelatihan Kader Dasar)</option>
                  <option value="PKL">PKL (Pelatihan Kader Lanjutan)</option>
                  <option value="Dirosah Ula">Dirosah Ula MDS Rijalul Ansor</option>
                  <option value="Dirosah Tsani">Dirosah Tsani MDS Rijalul Ansor</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Tanggal Pelaksanaan</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  required
                  value={formData.tanggal}
                  onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Lokasi Kegiatan</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.lokasi}
                  onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                  placeholder="Contoh: Aula PCNU Tasikmalaya"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 ml-1">Deskripsi Tambahan (Opsional)</label>
          <textarea
            value={formData.deskripsi}
            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all min-h-[120px]"
            placeholder="Informasi tambahan mengenai rencana kegiatan..."
          />
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex gap-4">
          <Info className="w-6 h-6 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 leading-relaxed">
            Pengajuan akan ditinjau oleh Pimpinan Cabang (PC). Anda akan menerima notifikasi status pengajuan (Disetujui/Ditolak) melalui dashboard ini.
          </p>
        </div>

        <div className="pt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Mengirim...' : <><CheckCircle2 className="w-5 h-5" /> Kirim Pengajuan</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default KaderisasiForm;
