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
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

const AllParticipants = () => {
  const { isAdminUtama, isAdminPAC, profile } = useAuth();
  const [participants, setParticipants] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJenis, setFilterJenis] = useState('all');
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

  const downloadAllIDCards = async () => {
    if (filteredParticipants.length === 0) return toast.error('Tidak ada peserta untuk didownload');
    if (filteredParticipants.length > 50) {
      if (!window.confirm(`Anda akan mendownload ${filteredParticipants.length} ID Card. Ini mungkin memakan waktu. Lanjutkan?`)) return;
    }

    setDownloading(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    
    try {
      for (let i = 0; i < filteredParticipants.length; i++) {
        const p = filteredParticipants[i];
        const event = events.find(e => e.id === p.kegiatan_id);
        
        // Set current participant for rendering
        setCurrentDownloadPeserta({ ...p, eventName: event?.nama, eventJenis: event?.jenis });
        
        // Wait for DOM update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (bulkIdCardRef.current) {
          const canvas = await html2canvas(bulkIdCardRef.current, { 
            scale: 2,
            useCORS: true,
            allowTaint: true
          });
          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }
      }
      
      pdf.save(`ID_Cards_${filterJenis === 'all' ? 'Semua' : filterJenis}_${format(new Date(), 'yyyyMMdd')}.pdf`);
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
            onClick={downloadAllIDCards}
            disabled={downloading || filteredParticipants.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {downloading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
            ) : (
              <><Download className="w-5 h-5" /> Download Semua ID Card</>
            )}
          </button>
        )}
      </header>

      {/* Hidden ID Card for Bulk Download */}
      <div className="fixed -left-[9999px] top-0">
        {currentDownloadPeserta && (
          <div 
            ref={bulkIdCardRef}
            className="w-[350px] h-[500px] bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col relative"
          >
            <div className="bg-green-700 p-6 text-white text-center">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-700 font-bold text-2xl mx-auto mb-2">S</div>
              <h3 className="font-bold text-lg leading-tight">SIMAK ANSOR</h3>
              <p className="text-[10px] opacity-80 tracking-widest uppercase">Tasikmalaya</p>
            </div>
            <div className="flex-1 p-6 flex flex-col items-center text-center">
              <div className="w-32 h-40 bg-slate-100 rounded-2xl border-4 border-white shadow-lg mb-4 overflow-hidden">
                <img src={currentDownloadPeserta.foto} alt={currentDownloadPeserta.nama} className="w-full h-full object-cover" crossOrigin="anonymous" />
              </div>
              <h4 className="text-xl font-bold text-slate-800 leading-tight mb-1">{currentDownloadPeserta.nama}</h4>
              <div className="flex flex-col gap-1 mb-4">
                <p className="text-sm text-slate-500 font-medium">{currentDownloadPeserta.eventName}</p>
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase self-center">
                  {currentDownloadPeserta.eventJenis}
                </span>
              </div>
              <div className="mt-auto bg-slate-50 p-3 rounded-2xl border border-slate-100 w-full flex flex-col items-center">
                <QRCodeSVG value={currentDownloadPeserta.qr_code} size={90} />
                <span className="text-[10px] font-mono text-slate-400 mt-2">{currentDownloadPeserta.qr_code}</span>
              </div>
            </div>
            <div className="h-2 bg-green-600 w-full" />
          </div>
        )}
      </div>

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
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
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
