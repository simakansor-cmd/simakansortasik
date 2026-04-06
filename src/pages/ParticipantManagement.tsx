import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { APP_LOGO } from '../constants';
import { 
  Users, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Download, 
  QrCode,
  GraduationCap,
  Award,
  Filter,
  MoreVertical,
  FileText,
  IdCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const ParticipantManagement = () => {
  const { kegiatanId } = useParams();
  const { profile, isAdminUtama, isAdminPAC } = useAuth();
  const navigate = useNavigate();
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [absensi, setAbsensi] = useState<any[]>([]);
  const [materi, setMateri] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const certificateRef = useRef<HTMLDivElement>(null);
  const [selectedPesertaForCert, setSelectedPesertaForCert] = useState<any>(null);
  const [gradConfig, setGradConfig] = useState({ min_attendance: 75 });
  const [downloadingID, setDownloadingID] = useState(false);
  const [currentDownloadPeserta, setCurrentDownloadPeserta] = useState<any>(null);
  const idCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!kegiatanId) return;

    const fetchConfig = async () => {
      const docRef = doc(db, 'settings', 'graduation');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setGradConfig(docSnap.data() as any);
      }
    };
    fetchConfig();

    const fetchKegiatan = async () => {
      const docRef = doc(db, 'kaderisasi', kegiatanId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Access control for PAC Admin
        if (isAdminPAC && !isAdminUtama && data.created_by !== profile?.uid) {
          toast.error('Anda tidak memiliki akses ke kegiatan ini');
          navigate('/dashboard');
          return;
        }

        setKegiatan({ id: docSnap.id, ...data });
        
        // Fetch materi for this type
        const mQuery = query(collection(db, 'materi'), where('kaderisasi_type', '==', data.jenis));
        const mSnapshot = await getDocs(mQuery);
        setMateri(mSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    };

    fetchKegiatan();

    const pQuery = query(collection(db, 'peserta'), where('kegiatan_id', '==', kegiatanId));
    const unsubscribeParticipants = onSnapshot(pQuery, (snapshot) => {
      setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const aQuery = query(collection(db, 'absensi'), where('kegiatan_id', '==', kegiatanId));
    const unsubscribeAbsensi = onSnapshot(aQuery, (snapshot) => {
      setAbsensi(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeParticipants();
      unsubscribeAbsensi();
    };
  }, [kegiatanId]);

  const handleGraduationUpdate = async (id: string, status: 'lulus' | 'tidak_lulus') => {
    try {
      await updateDoc(doc(db, 'peserta', id), { status_kelulusan: status });
      toast.success(`Status kelulusan diperbarui: ${status}`);
    } catch (error: any) {
      toast.error('Gagal memperbarui status: ' + error.message);
    }
  };

  const generateCertificate = async (peserta: any) => {
    setSelectedPesertaForCert(peserta);
    // Wait for state update and render
    setTimeout(async () => {
      if (!certificateRef.current) return;
      const canvas = await html2canvas(certificateRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Sertifikat_${peserta.nama}_${kegiatan.jenis}.pdf`);
      setSelectedPesertaForCert(null);
    }, 500);
  };

  const downloadIDCard = async (peserta: any) => {
    setDownloadingID(true);
    setCurrentDownloadPeserta(peserta);
    
    // Wait for DOM update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      if (idCardRef.current) {
        const canvas = await html2canvas(idCardRef.current, { 
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`ID_Card_${peserta.nama}_${peserta.nik}.pdf`);
        toast.success(`ID Card ${peserta.nama} berhasil didownload`);
      }
    } catch (error) {
      console.error('Error downloading ID card:', error);
      toast.error('Gagal mendownload ID Card');
    } finally {
      setDownloadingID(false);
      setCurrentDownloadPeserta(null);
    }
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.nama.toLowerCase().includes(searchTerm.toLowerCase()) || p.nik.includes(searchTerm);
    const matchesFilter = filterStatus === 'all' || p.status_kelulusan === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getAttendanceCount = (pesertaId: string) => {
    return absensi.filter(a => a.peserta_id === pesertaId).length;
  };

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data...</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{kegiatan?.nama}</h1>
            <p className="text-slate-500 mt-1">Manajemen peserta dan kelulusan.</p>
          </div>
        </div>
        {isAdminPAC && (
          <Link 
            to={`/scan/${kegiatanId}`}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all flex items-center gap-2"
          >
            <QrCode className="w-5 h-5" />
            Scan Absensi
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{participants.length}</div>
            <div className="text-sm text-slate-500">Total Peserta</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{participants.filter(p => p.status_kelulusan === 'lulus').length}</div>
            <div className="text-sm text-slate-500">Peserta Lulus</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{participants.filter(p => p.status_kelulusan === 'pending').length}</div>
            <div className="text-sm text-slate-500">Menunggu Penilaian</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari nama atau NIK..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-slate-400" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="lulus">Lulus</option>
              <option value="tidak_lulus">Tidak Lulus</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Peserta</th>
                <th className="px-6 py-4">NIK & Kontak</th>
                <th className="px-6 py-4">Kehadiran</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredParticipants.length > 0 ? filteredParticipants.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        <img src={p.foto} alt={p.nama} className="w-full h-full object-cover" />
                      </div>
                      <div className="font-bold text-slate-800">{p.nama}</div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-slate-600 font-mono">{p.nik}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.no_hp}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                        <div 
                          className="h-full bg-green-500" 
                          style={{ width: `${(getAttendanceCount(p.id) / (materi.length || 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600">
                          {getAttendanceCount(p.id)}/{materi.length}
                        </span>
                        <span className={`text-[9px] font-bold uppercase ${
                          (getAttendanceCount(p.id) / (materi.length || 1)) * 100 >= gradConfig.min_attendance
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}>
                          {(getAttendanceCount(p.id) / (materi.length || 1)) * 100 >= gradConfig.min_attendance ? 'Layak' : 'Tdk Layak'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      p.status_kelulusan === 'lulus' ? 'bg-green-100 text-green-700' : 
                      p.status_kelulusan === 'tidak_lulus' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.status_kelulusan}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAdminPAC && p.status_kelulusan === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleGraduationUpdate(p.id, 'lulus')}
                            className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                            title="Luluskan"
                          >
                            <GraduationCap className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleGraduationUpdate(p.id, 'tidak_lulus')}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                            title="Tidak Lulus"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {p.status_kelulusan === 'lulus' && (
                        <button 
                          onClick={() => generateCertificate(p)}
                          className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                          title="Unduh Sertifikat"
                        >
                          <Award className="w-5 h-5" />
                        </button>
                      )}
                      <button 
                        onClick={() => downloadIDCard(p)}
                        className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                        title="Unduh ID Card"
                      >
                        <IdCard className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Belum ada peserta yang terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden ID Card Template for PDF Generation */}
      <div className="fixed -left-[9999px] top-0">
        {currentDownloadPeserta && (
          <div 
            ref={idCardRef}
            className="w-[380px] h-[580px] bg-white flex flex-col relative"
            style={{ padding: '0', margin: '0' }}
          >
            {/* Header Section */}
            <div className="h-32 bg-green-700 relative flex flex-col items-center justify-center overflow-hidden">
              {/* Decorative Background Patterns */}
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full" />
              </div>
              
              {/* Logo Container - Perfectly Centered */}
              <div className="relative z-10 w-20 h-20 bg-white rounded-2xl p-2.5 shadow-xl flex items-center justify-center">
                <img 
                  src={APP_LOGO} 
                  alt="Logo" 
                  className="w-full h-full object-contain" 
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>
            
            {/* Content Section */}
            <div className="flex-1 flex flex-col items-center px-8 pt-10 pb-8 bg-white">
              {/* Photo - Symmetrical Circle */}
              <div className="w-32 h-32 rounded-full border-[5px] border-white shadow-2xl overflow-hidden mb-6 -mt-20 relative z-20 bg-slate-100">
                <img 
                  src={currentDownloadPeserta.foto} 
                  alt={currentDownloadPeserta.nama} 
                  className="w-full h-full object-cover" 
                  crossOrigin="anonymous"
                />
              </div>
              
              {/* Identity Info */}
              <div className="space-y-2 mb-6 w-full">
                <h4 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight text-center">
                  {currentDownloadPeserta.nama}
                </h4>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-slate-500 font-bold text-center max-w-[280px]">
                    {kegiatan.nama}
                  </p>
                  <span className="inline-flex items-center px-5 py-1.5 rounded-full bg-green-100 text-green-700 text-[11px] font-black uppercase tracking-[0.15em]">
                    {kegiatan.jenis}
                  </span>
                </div>
              </div>
              
              {/* QR Code Section - Centered and Proportional */}
              <div className="mt-auto flex flex-col items-center w-full">
                <div className="bg-slate-50 p-5 rounded-[2.5rem] border-2 border-slate-100 shadow-inner flex items-center justify-center">
                  <QRCodeSVG 
                    value={currentDownloadPeserta.qr_code} 
                    size={120} 
                    level="H" 
                    includeMargin={true} 
                  />
                </div>
                <div className="mt-4 flex flex-col items-center">
                  <span className="text-[11px] font-black text-slate-900 tracking-[0.25em] font-mono uppercase">
                    {currentDownloadPeserta.qr_code}
                  </span>
                  <div className="h-1.5 w-16 bg-green-600 rounded-full mt-3" />
                </div>
              </div>
            </div>

            {/* Footer Strip */}
            <div className="h-3 bg-green-700 w-full flex">
              <div className="flex-1 bg-green-800" />
              <div className="flex-1 bg-green-600" />
              <div className="flex-1 bg-green-700" />
            </div>
          </div>
        )}
      </div>

      {/* Hidden Certificate Template for PDF Generation */}
      <div className="fixed -left-[9999px] top-0">
        {selectedPesertaForCert && (
          <div 
            ref={certificateRef}
            className="w-[1123px] h-[794px] bg-white p-16 flex flex-col items-center justify-center relative overflow-hidden"
            style={{ fontFamily: 'serif' }}
          >
            {/* Border Decoration */}
            <div className="absolute inset-8 border-[12px] border-green-800" />
            <div className="absolute inset-12 border-2 border-green-600" />
            
            {/* Content */}
            <div className="z-10 flex flex-col items-center text-center max-w-4xl">
              <div className="w-24 h-24 bg-green-800 rounded-2xl flex items-center justify-center text-white font-bold text-5xl mb-8">S</div>
              <h1 className="text-6xl font-bold text-slate-900 mb-4 tracking-tight">SERTIFIKAT</h1>
              <h2 className="text-2xl font-medium text-slate-600 mb-12 uppercase tracking-[0.2em]">Kaderisasi GP Ansor Tasikmalaya</h2>
              
              <p className="text-xl text-slate-500 mb-4 italic">Diberikan kepada:</p>
              <h3 className="text-5xl font-bold text-green-800 mb-8 underline decoration-green-200 underline-offset-8">{selectedPesertaForCert.nama}</h3>
              
              <p className="text-xl text-slate-700 leading-relaxed mb-12">
                Dinyatakan telah <span className="font-bold">LULUS</span> dalam mengikuti kegiatan <br />
                <span className="font-bold text-2xl text-slate-900 uppercase">{kegiatan.nama}</span> <br />
                yang diselenggarakan oleh {kegiatan.pac_name} pada tanggal {format(new Date(kegiatan.tanggal), 'dd MMMM yyyy', { locale: id })}.
              </p>
              
              <div className="w-full flex justify-between items-end mt-8 px-12">
                <div className="text-center">
                  <div className="w-32 h-0.5 bg-slate-300 mb-2 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Pimpinan Cabang</p>
                  <p className="text-xs text-slate-500">GP Ansor Tasikmalaya</p>
                </div>
                <div className="text-center">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2 flex items-center justify-center">
                    <QRCodeSVG value={`SIMAK-${kegiatan.id}-${selectedPesertaForCert.nik}`} size={80} />
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">VERIFIED: {selectedPesertaForCert.qr_code || selectedPesertaForCert.id}</p>
                </div>
                <div className="text-center">
                  <div className="w-32 h-0.5 bg-slate-300 mb-2 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Pimpinan Anak Cabang</p>
                  <p className="text-xs text-slate-500">{kegiatan.pac_name}</p>
                </div>
              </div>
            </div>

            {/* Background Decoration */}
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-green-50 rounded-full opacity-50" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-green-50 rounded-full opacity-50" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantManagement;
