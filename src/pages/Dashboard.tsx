import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, getCountFromServer, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Users, 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpRight,
  Calendar,
  MapPin,
  ChevronRight,
  GraduationCap,
  UserCog,
  ClipboardCheck,
  IdCard,
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
import { useRef } from 'react';

const Dashboard = () => {
  const { profile, isAdminUtama, isAdminPAC, isPeserta } = useAuth();
  const [stats, setStats] = useState({
    totalKaderisasi: 0,
    pendingKaderisasi: 0,
    totalPeserta: 0,
    totalLulus: 0,
    totalUsers: 0
  });
  const [pesertaData, setPesertaData] = useState<any>(null);
  const [pesertaEvent, setPesertaEvent] = useState<any>(null);
  const [attendancePercent, setAttendancePercent] = useState(0);
  const [showQRModal, setShowQRModal] = useState<any>(null);
  const [recentKaderisasi, setRecentKaderisasi] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const qrPdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If AuthContext is still loading, wait
    if (!profile && !isAdminUtama && !isPeserta) {
      // If we don't have enough info yet, but AuthContext says it's done loading,
      // we should still stop the dashboard loading spinner
      const timer = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(timer);
    }

    let q;
    if (isAdminUtama) {
      q = query(collection(db, 'kaderisasi'));
    } else if (isAdminPAC) {
      q = query(collection(db, 'kaderisasi'), where('created_by', '==', profile.uid));
    }

    if (q) {
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentKaderisasi(data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));
        
        // Calculate stats
        const total = data.length;
        const pending = data.filter((k: any) => k.status === 'pending').length;
        
        // Fetch counts efficiently
        const fetchStatsCounts = async () => {
          let pesertaCount = 0;
          let lulusCount = 0;
          
          if (isAdminUtama) {
            const pQuery = query(collection(db, 'peserta'));
            const lQuery = query(collection(db, 'peserta'), where('status_kelulusan', '==', 'lulus'));
            
            const [pSnap, lSnap] = await Promise.all([
              getCountFromServer(pQuery),
              getCountFromServer(lQuery)
            ]);
            
            pesertaCount = pSnap.data().count;
            lulusCount = lSnap.data().count;
          } else {
            const eventIds = data.map(d => d.id);
            if (eventIds.length > 0) {
              const pQuery = query(collection(db, 'peserta'), where('kegiatan_id', 'in', eventIds));
              const lQuery = query(collection(db, 'peserta'), where('kegiatan_id', 'in', eventIds), where('status_kelulusan', '==', 'lulus'));
              
              const [pSnap, lSnap] = await Promise.all([
                getCountFromServer(pQuery),
                getCountFromServer(lQuery)
              ]);
              
              pesertaCount = pSnap.data().count;
              lulusCount = lSnap.data().count;
            }
          }

          setStats(prev => ({
            ...prev,
            totalKaderisasi: total,
            pendingKaderisasi: pending,
            totalPeserta: pesertaCount,
            totalLulus: lulusCount
          }));
        };

        fetchStatsCounts();

        if (isAdminUtama) {
          const uQuery = collection(db, 'users');
          getCountFromServer(uQuery).then(uSnap => {
            setStats(prev => ({ ...prev, totalUsers: uSnap.data().count }));
          });
          
          // Only fetch a few recent users for display
          const recentUsersQuery = query(collection(db, 'users'), orderBy('created_at', 'desc'), limit(10));
          getDocs(recentUsersQuery).then(uSnapshot => {
            setUsers(uSnapshot.docs.map(d => d.data()));
          });
        }

        setLoading(false);
      });
      return () => unsubscribe();
    } else if (isPeserta && profile?.peserta_id) {
      // For Peserta, show their registered event and attendance
      const fetchPesertaDashboard = async () => {
        try {
          // 1. Get Peserta Data
          const pDoc = await getDoc(doc(db, 'peserta', profile.peserta_id));
          if (pDoc.exists()) {
            const pData = pDoc.data();
            setPesertaData({ id: pDoc.id, ...pData });

            // 2. Get Event Data
            const eDoc = await getDoc(doc(db, 'kaderisasi', pData.kegiatan_id));
            if (eDoc.exists()) {
              const eData = eDoc.data();
              setPesertaEvent({ id: eDoc.id, ...eData });

              // 3. Calculate Attendance
              const mQuery = query(collection(db, 'materi'), where('kaderisasi_type', '==', eData.jenis));
              const mSnapshot = await getDocs(mQuery);
              const totalMateri = mSnapshot.size;

              const aQuery = query(collection(db, 'absensi'), where('peserta_id', '==', pDoc.id));
              const aSnapshot = await getDocs(aQuery);
              const attendedCount = aSnapshot.size;

              setAttendancePercent(Math.round((attendedCount / (totalMateri || 1)) * 100));
            }
          }
        } catch (error) {
          console.error("Error fetching peserta dashboard:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchPesertaDashboard();
    } else {
      setLoading(false);
    }
  }, [profile, isAdminUtama, isAdminPAC, isPeserta]);

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
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data...</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isAdminUtama ? 'Dashboard Admin Utama' : isAdminPAC ? 'Dashboard Admin PAC' : 'Dashboard Peserta'}
          </h1>
          <p className="text-slate-500 mt-1">Assalamu'alaikum, {profile?.name}. Selamat datang di SIMAK Ansor Tasikmalaya.</p>
        </div>
        {isAdminPAC && (
          <Link 
            to="/kaderisasi/new" 
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all flex items-center gap-2 w-fit"
          >
            <Building2 className="w-5 h-5" />
            Ajukan Kaderisasi
          </Link>
        )}
      </header>

      {(isAdminUtama || isAdminPAC) && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <StatCard 
            title="Total Kaderisasi" 
            value={stats.totalKaderisasi} 
            icon={Building2} 
            color="blue" 
          />
          <StatCard 
            title="Pengajuan Pending" 
            value={stats.pendingKaderisasi} 
            icon={Clock} 
            color="amber" 
          />
          <StatCard 
            title="Total Peserta" 
            value={stats.totalPeserta} 
            icon={Users} 
            color="green" 
          />
          <StatCard 
            title="Peserta Lulus" 
            value={stats.totalLulus} 
            icon={CheckCircle2} 
            color="indigo" 
          />
          {isAdminUtama && (
            <Link to="/accounts">
              <StatCard 
                title="Total Akun" 
                value={stats.totalUsers} 
                icon={UserCog} 
                color="red" 
              />
            </Link>
          )}
          {isAdminPAC && (
            <Link to="/absensi">
              <StatCard 
                title="Scan Absensi" 
                value="Scan" 
                icon={ClipboardCheck} 
                color="green" 
              />
            </Link>
          )}
          {isAdminUtama && (
            <Link to="/accounts">
              <StatCard 
                title="Kelola Akun" 
                value={users.length} 
                icon={UserCog} 
                color="red" 
              />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {isPeserta ? (
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 md:p-10">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="w-full md:w-48 shrink-0">
                    <div className="aspect-[2/3] rounded-3xl bg-slate-100 border-4 border-white shadow-xl overflow-hidden relative group">
                      <img src={pesertaData?.foto} alt={pesertaData?.nama} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-6">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">{pesertaData?.nama}</h2>
                      <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                        <IdCard className="w-4 h-4" />
                        NIK: {pesertaData?.nik}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status Kehadiran</div>
                        <div className={`text-sm font-bold ${pesertaData?.status === 'Peserta' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {pesertaData?.status || 'Calon Peserta'}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status Kelulusan</div>
                        <div className={`text-sm font-bold ${
                          pesertaData?.status_kelulusan === 'lulus' ? 'text-green-600' : 
                          pesertaData?.status_kelulusan === 'tidak_lulus' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {pesertaData?.status_kelulusan?.toUpperCase() || 'PENDING'}
                        </div>
                      </div>
                    </div>

                    {pesertaData?.status !== 'Peserta' && pesertaEvent && (
                      <Link 
                        to={`/check-in/${pesertaEvent.id}`}
                        className="flex items-center justify-center gap-3 w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-green-200 transition-all group"
                      >
                        <ClipboardCheck className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        CHECK-IN SEKARANG
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center text-center">
                  <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="12"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        fill="transparent"
                        stroke="#16a34a"
                        strokeWidth="12"
                        strokeDasharray={364.4}
                        strokeDashoffset={364.4 - (364.4 * attendancePercent) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-slate-900">{attendancePercent}%</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800">Kehadiran Materi</h3>
                  <p className="text-xs text-slate-400 mt-1">Persentase kehadiran sesi materi</p>
                </div>

                <div className="bg-green-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-green-200 relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="font-bold text-lg mb-2">Kegiatan Terdaftar</h3>
                    <div className="space-y-1">
                      <div className="text-2xl font-black tracking-tight">{pesertaEvent?.nama}</div>
                      <div className="flex items-center gap-2 text-green-100 text-sm font-medium">
                        <MapPin className="w-4 h-4" />
                        {pesertaEvent?.lokasi}
                      </div>
                    </div>
                  </div>
                  <Calendar className="absolute -bottom-6 -right-6 w-32 h-32 text-white/10 rotate-12" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                Kaderisasi Terbaru
              </h2>
              <Link to="/kaderisasi" className="text-sm text-green-600 font-semibold hover:underline flex items-center gap-1">
                Lihat Semua <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {recentKaderisasi.length > 0 ? recentKaderisasi.map((item) => (
                <div key={item.id} className="p-4 md:p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-bold text-base md:text-lg shrink-0 ${
                      item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.jenis.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 group-hover:text-green-700 transition-colors truncate">{item.nama}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.lokasi}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{format(new Date(item.tanggal), 'dd MMMM yyyy', { locale: id })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider ${
                      item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status}
                    </span>
                    <Link to={`/participants/${item.id}`} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
                      <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-green-600" />
                    </Link>
                    {item.status === 'approved' && (
                      <button 
                        onClick={() => setShowQRModal(item)}
                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                        title="Generate QR Check-in"
                      >
                        <QrCode className="w-5 h-5 text-slate-400 group-hover:text-green-600" />
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-10 text-center text-slate-500">Belum ada data kaderisasi.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-8 text-white shadow-xl shadow-green-200 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Informasi Penting</h3>
              <p className="text-green-50/80 text-sm leading-relaxed mb-6">
                Pastikan setiap pengajuan kaderisasi dilakukan minimal 2 minggu sebelum pelaksanaan untuk proses verifikasi.
              </p>
              <button className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                Baca Panduan
              </button>
            </div>
            <Building2 className="absolute -bottom-6 -right-6 w-32 h-32 text-white/10 rotate-12" />
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-green-600" />
              Jenis Kaderisasi
            </h3>
            <div className="space-y-3">
              {['PKD', 'PKL', 'Dirosah Ula', 'Dirosah Tsani'].map((type) => (
                <div key={type} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-slate-700 text-sm font-medium">
                  {type}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    )}
  </div>

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

const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm"
    >
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 ${colors[color]}`}>
        <Icon className="w-5 h-5 md:w-6 md:h-6" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl md:text-3xl font-bold text-slate-900">{value}</span>
        <span className="text-[10px] md:text-sm text-slate-500 mt-0.5 md:mt-1 uppercase md:capitalize tracking-wider md:tracking-normal">{title}</span>
      </div>
    </motion.div>
  );
};

export default Dashboard;
