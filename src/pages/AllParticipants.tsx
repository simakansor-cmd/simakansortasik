import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Users, 
  Search, 
  Filter,
  Building2,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { APP_LOGO } from '../constants';

const AllParticipants = () => {
  const { isAdminUtama, isAdminPAC, profile } = useAuth();
  const [participants, setParticipants] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJenis, setFilterJenis] = useState('all');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedEventForDownload, setSelectedEventForDownload] = useState('all');
  const bulkIdCardRef = useRef<HTMLDivElement>(null);
  const [currentDownloadPeserta, setCurrentDownloadPeserta] = useState<any>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      const eSnapshot = await getDocs(collection(db, 'kaderisasi'));
      const eData = eSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eData);
    };

    fetchEvents();

    const pQuery = collection(db, 'peserta');
    const unsubscribe = onSnapshot(pQuery, (snapshot) => {
      setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getEventName = (eventId: string) => {
    return events.find(e => e.id === eventId)?.nama || 'Unknown Event';
  };

  const getEventPAC = (eventId: string) => {
    return events.find(e => e.id === eventId)?.pac_name || 'Unknown PAC';
  };

  const getEventJenis = (eventId: string) => {
    return events.find(e => e.id === eventId)?.jenis || '';
  };

  const filteredParticipants = participants.filter(p => {
    const event = events.find(e => e.id === p.kegiatan_id);
    const matchesSearch = p.nama.toLowerCase().includes(searchTerm.toLowerCase()) || p.nik.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || p.status_kelulusan === filterStatus;
    const matchesJenis = filterJenis === 'all' || event?.jenis === filterJenis;
    
    // If PAC admin, only show participants in their events
    if (isAdminPAC && !isAdminUtama) {
      if (event?.created_by !== profile?.uid) return false;
    }

    return matchesSearch && matchesStatus && matchesJenis;
  });

  const downloadSingleIDCard = async (p: any, event: any) => {
    setDownloading(true);
    setCurrentDownloadPeserta({ ...p, eventName: event?.nama, eventJenis: event?.jenis });
    
    // Wait for DOM update
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      if (bulkIdCardRef.current) {
        const canvas = await html2canvas(bulkIdCardRef.current, { 
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
        pdf.save(`ID_Card_${p.nama}_${p.nik}.pdf`);
        toast.success(`ID Card ${p.nama} berhasil didownload`);
      }
    } catch (error) {
      console.error('Error downloading ID card:', error);
      toast.error('Gagal mendownload ID Card');
    } finally {
      setDownloading(false);
      setCurrentDownloadPeserta(null);
    }
  };

  const downloadAllIDCards = async () => {
    const participantsToDownload = participants.filter(p => {
      const matchesEvent = selectedEventForDownload === 'all' || p.kegiatan_id === selectedEventForDownload;
      return matchesEvent;
    });

    if (participantsToDownload.length === 0) return toast.error('Tidak ada peserta untuk didownload');
    
    setShowDownloadModal(false);
    setDownloading(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    
    try {
      for (let i = 0; i < participantsToDownload.length; i++) {
        const p = participantsToDownload[i];
        const event = events.find(e => e.id === p.kegiatan_id);
        
        // Set current participant for rendering
        setCurrentDownloadPeserta({ ...p, eventName: event?.nama, eventJenis: event?.jenis });
        
        // Wait for DOM update
        await new Promise(resolve => setTimeout(resolve, 150));
        
        if (bulkIdCardRef.current) {
          const canvas = await html2canvas(bulkIdCardRef.current, { 
            scale: 3, // Higher scale for better quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }
      }
      
      pdf.save(`ID_Cards_${selectedEventForDownload === 'all' ? 'Semua' : 'Event'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('Berhasil mendownload semua ID Card');
    } catch (error) {
      console.error('Error downloading ID cards:', error);
      toast.error('Gagal mendownload ID Card');
    } finally {
      setDownloading(false);
      setCurrentDownloadPeserta(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data...</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isAdminPAC && !isAdminUtama ? 'Daftar Peserta Saya' : 'Daftar Semua Peserta'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdminPAC && !isAdminUtama 
              ? 'Lihat dan kelola peserta pada kegiatan yang Anda laksanakan.' 
              : 'Lihat dan kelola semua peserta yang telah mendaftar.'}
          </p>
        </div>
        {isAdminUtama && (
          <button
            onClick={() => setShowDownloadModal(true)}
            disabled={downloading || participants.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {downloading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
            ) : (
              <><Download className="w-5 h-5" /> Download ID Card</>
            )}
          </button>
        )}
      </header>

      {/* Hidden ID Card for Bulk Download */}
      <div className="fixed -left-[9999px] top-0">
        {currentDownloadPeserta && (
          <div 
            ref={bulkIdCardRef}
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
                    {currentDownloadPeserta.eventName}
                  </p>
                  <span className="inline-flex items-center px-5 py-1.5 rounded-full bg-green-100 text-green-700 text-[11px] font-black uppercase tracking-[0.15em]">
                    {currentDownloadPeserta.eventJenis}
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

      {/* Download Selection Modal */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDownloadModal(false)}
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
                  <Download className="w-6 h-6 text-green-600" />
                  Download ID Card
                </h2>
                <button onClick={() => setShowDownloadModal(false)} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Pilih Pelatihan / Kegiatan</label>
                  <select 
                    value={selectedEventForDownload}
                    onChange={(e) => setSelectedEventForDownload(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none"
                  >
                    <option value="all">Semua Kegiatan</option>
                    {events.map(e => (
                      <option key={e.id} value={e.id}>{e.nama} ({e.jenis})</option>
                    ))}
                  </select>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Proses generate PDF akan memakan waktu beberapa saat tergantung jumlah peserta. Mohon jangan menutup halaman ini selama proses berlangsung.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowDownloadModal(false)}
                    className="flex-1 px-6 py-4 border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={downloadAllIDCards}
                    className="flex-2 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-green-200 transition-all"
                  >
                    Mulai Download
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{filteredParticipants.length}</div>
            <div className="text-sm text-slate-500">Peserta Terfilter</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{filteredParticipants.filter(p => p.status_kelulusan === 'lulus').length}</div>
            <div className="text-sm text-slate-500">Lulus</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{filteredParticipants.filter(p => p.status_kelulusan === 'pending').length}</div>
            <div className="text-sm text-slate-500">Pending</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{filteredParticipants.filter(p => p.status_kelulusan === 'tidak_lulus').length}</div>
            <div className="text-sm text-slate-500">Tidak Lulus</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
              >
                <option value="all">Semua Jenis</option>
                <option value="PKD">PKD</option>
                <option value="PKL">PKL</option>
                <option value="Dirosah Ula">Dirosah Ula</option>
                <option value="Dirosah Tsani">Dirosah Tsani</option>
              </select>
            </div>
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
                <th className="px-6 py-4">Kegiatan & PAC</th>
                <th className="px-6 py-4">NIK & Kontak</th>
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
                    <div className="text-sm font-medium text-slate-800">{getEventName(p.kegiatan_id)}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" />
                      {getEventPAC(p.kegiatan_id)}
                      <span className="mx-1">•</span>
                      <span className="font-bold text-green-600">{getEventJenis(p.kegiatan_id)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-slate-600 font-mono">{p.nik}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.no_hp}</div>
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
                    <button 
                      onClick={() => {
                        const event = events.find(e => e.id === p.kegiatan_id);
                        downloadSingleIDCard(p, event);
                      }}
                      className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                      title="Download ID Card"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Belum ada peserta yang terdaftar dengan kriteria ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllParticipants;
