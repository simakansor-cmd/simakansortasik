import React, { useEffect, useState, useRef } from 'react';
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
  Users,
  QrCode,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { APP_LOGO } from '../constants';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const KaderisasiManagement = () => {
  const { profile, isAdminUtama, isAdminPAC } = useAuth();
  const [kaderisasiList, setKaderisasiList] = useState<any[]>([]);
  const [materiList, setMateriList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMateriModal, setShowMateriModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState<any>(null);
  const [newMateri, setNewMateri] = useState({ nama: '', kaderisasi_type: 'PKD' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const qrPdfRef = useRef<HTMLDivElement>(null);

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

  const downloadActivityPDF = async () => {
    if (!qrPdfRef.current || !showQRModal) return;
    
    setIsSubmitting(true);
    try {
      const canvas = await html2canvas(qrPdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`QR_Checkin_${showQRModal.nama}.pdf`);
      toast.success('PDF berhasil diunduh');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Gagal membuat PDF');
    } finally {
      setIsSubmitting(false);
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
                      {item.status === 'approved' && (
                        <button 
                          onClick={() => setShowQRModal(item)}
                          className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                          title="Generate QR Check-in"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                      )}
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

      {/* QR Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQRModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center bg-green-600 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <QrCode className="w-64 h-64 -rotate-12 -translate-x-10 -translate-y-10" />
                </div>
                <h2 className="text-2xl font-black tracking-tight relative z-10">QR CHECK-IN MANDIRI</h2>
                <p className="text-green-100 text-sm font-medium relative z-10 opacity-90">{showQRModal.nama}</p>
              </div>

              <div className="p-10 flex flex-col items-center gap-8">
                <div className="p-6 bg-white rounded-3xl shadow-xl border border-slate-100 relative group">
                  <QRCodeSVG 
                    value={`${window.location.origin}/check-in/${showQRModal.id}`}
                    size={240}
                    level="H"
                    imageSettings={{
                      src: APP_LOGO,
                      x: undefined,
                      y: undefined,
                      height: 48,
                      width: 48,
                      excavate: true,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl">
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          const svg = document.querySelector('.p-6 svg') as SVGElement;
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          const img = new Image();
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx?.drawImage(img, 0, 0);
                            const pngFile = canvas.toDataURL('image/png');
                            const downloadLink = document.createElement('a');
                            downloadLink.download = `QR-Checkin-${showQRModal.nama}.png`;
                            downloadLink.href = pngFile;
                            downloadLink.click();
                          };
                          img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        PNG
                      </button>
                      <button 
                        onClick={downloadActivityPDF}
                        disabled={isSubmitting}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {isSubmitting ? '...' : 'PDF'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Scan QR ini menggunakan perangkat peserta untuk melakukan check-in mandiri di lokasi kegiatan.
                  </p>
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    ID: {showQRModal.id}
                  </div>
                </div>

                <button 
                  onClick={() => setShowQRModal(null)}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden PDF Template */}
      <div className="fixed -left-[9999px] top-0">
        {showQRModal && (
          <div 
            ref={qrPdfRef}
            className="w-[800px] bg-white p-12 flex flex-col items-center"
          >
            {/* Design Header */}
            <div className="w-full h-48 bg-green-700 rounded-[3rem] relative overflow-hidden flex items-center justify-center mb-12">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <QrCode className="w-96 h-96 -rotate-12 -translate-x-20 -translate-y-20 text-white" />
              </div>
              <div className="relative z-10 flex items-center gap-8">
                <div className="w-24 h-24 bg-white rounded-3xl p-4 shadow-2xl">
                  <img src={APP_LOGO} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="text-white">
                  <h1 className="text-4xl font-black tracking-tighter uppercase">QR CHECK-IN MANDIRI</h1>
                  <p className="text-green-100 text-xl font-bold opacity-80">GP ANSOR KABUPATEN TASIKMALAYA</p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="w-full flex flex-col items-center gap-12">
              <div className="text-center space-y-4">
                <span className="px-6 py-2 rounded-full bg-green-100 text-green-700 text-lg font-black uppercase tracking-widest">
                  {showQRModal.jenis}
                </span>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight uppercase max-w-2xl">
                  {showQRModal.nama}
                </h2>
              </div>

              <div className="p-12 bg-white rounded-[4rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border-4 border-slate-50 relative">
                <QRCodeSVG 
                  value={`${window.location.origin}/check-in/${showQRModal.id}`}
                  size={400}
                  level="H"
                  imageSettings={{
                    src: APP_LOGO,
                    x: undefined,
                    y: undefined,
                    height: 80,
                    width: 80,
                    excavate: true,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-8 w-full max-w-2xl mt-4">
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-center">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Lokasi Pelaksanaan</div>
                  <div className="text-xl font-bold text-slate-800">{showQRModal.lokasi}</div>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-center">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Tanggal Kegiatan</div>
                  <div className="text-xl font-bold text-slate-800">
                    {format(new Date(showQRModal.tanggal), 'dd MMMM yyyy', { locale: id })}
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-slate-400 font-medium text-lg">
                  Scan QR ini untuk melakukan absensi kehadiran secara mandiri.
                </p>
                <div className="mt-6 flex items-center justify-center gap-4">
                  <div className="h-1.5 w-24 bg-green-600 rounded-full" />
                  <span className="text-sm font-black text-slate-300 tracking-[0.5em] uppercase">SIMAK ANSOR</span>
                  <div className="h-1.5 w-24 bg-green-600 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KaderisasiManagement;
