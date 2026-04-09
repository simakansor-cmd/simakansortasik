import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_LOGO } from '../constants';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { 
  QrCode, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  Users, 
  History,
  Camera,
  RefreshCw,
  Download,
  Printer,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import FaceScanner from '../components/FaceScanner';

const AttendanceScanner = () => {
  const { kegiatanId } = useParams();
  const { profile, isAdminUtama, isAdminPAC } = useAuth();
  const navigate = useNavigate();
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [materi, setMateri] = useState<any[]>([]);
  const [selectedMateri, setSelectedMateri] = useState<string>('');
  const [recentAbsensi, setRecentAbsensi] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannerType, setScannerType] = useState<'qr' | 'face'>('qr');
  const [showEventQR, setShowEventQR] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const eventQrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!kegiatanId) return;

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
        const materiData = mSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setMateri(materiData);
        if (materiData.length > 0) setSelectedMateri(materiData[0].id);
      }
    };

    fetchKegiatan();

    const aQuery = query(collection(db, 'absensi'), where('kegiatan_id', '==', kegiatanId));
    const unsubscribeAbsensi = onSnapshot(aQuery, async (snapshot) => {
      const absensiData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Fetch participant names for recent absensi
      const withNames = await Promise.all(absensiData.map(async (a: any) => {
        const pDoc = await getDoc(doc(db, 'peserta', a.peserta_id));
        const mDoc = await getDoc(doc(db, 'materi', a.materi_id));
        return { 
          ...a, 
          peserta_nama: pDoc.exists() ? pDoc.data().nama : 'Unknown',
          materi_nama: mDoc.exists() ? mDoc.data().nama : 'Unknown'
        };
      }));
      setRecentAbsensi(withNames.sort((a: any, b: any) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime()).slice(0, 5));
    });

    return () => {
      unsubscribeAbsensi();
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, [kegiatanId]);

  const startScanner = async () => {
    if (!selectedMateri) return toast.error('Pilih materi terlebih dahulu');
    setScanning(true);
    
    // Give a small delay for the DOM to render the reader div
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdgeSize * 0.7);
            return {
              width: qrboxSize,
              height: qrboxSize
            };
          }
        };

        // Prefer back camera
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          onScanSuccess, 
          onScanFailure
        );
      } catch (err: any) {
        console.error("Failed to start scanner", err);
        toast.error("Gagal membuka kamera: " + err);
        setScanning(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setScanning(false);
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Failed to stop scanner", err);
        setScanning(false);
      }
    } else {
      setScanning(false);
    }
  };

  const recordAbsensi = async (pesertaId: string) => {
    if (!selectedMateri) {
      toast.error('Pilih materi terlebih dahulu');
      return;
    }

    try {
      const pDoc = await getDoc(doc(db, 'peserta', pesertaId));
      if (!pDoc.exists()) {
        toast.error('Peserta tidak ditemukan');
        return;
      }

      const pesertaData = pDoc.data();

      // Check if already absensi for this materi
      const aQuery = query(collection(db, 'absensi'), 
        where('peserta_id', '==', pesertaId), 
        where('materi_id', '==', selectedMateri)
      );
      const aSnapshot = await getDocs(aQuery);
      
      if (!aSnapshot.empty) {
        toast.warning(`${pesertaData.nama} sudah absen untuk materi ini`);
        return;
      }

      // Record absensi
      await addDoc(collection(db, 'absensi'), {
        peserta_id: pesertaId,
        materi_id: selectedMateri,
        kegiatan_id: kegiatanId,
        waktu: new Date().toISOString()
      });

      // Update status to 'Peserta' if it's currently 'Calon Peserta'
      if (pesertaData.status === 'Calon Peserta') {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'peserta', pesertaId), {
          status: 'Peserta'
        });
      }

      toast.success(`Absensi berhasil: ${pesertaData.nama}`);
    } catch (error: any) {
      toast.error('Gagal mencatat absensi: ' + error.message);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    // Expected format: SIMAK-kegiatanId-nik
    const parts = decodedText.split('-');
    if (parts.length < 3 || parts[0] !== 'SIMAK') {
      toast.error('Format QR Code tidak valid');
      return;
    }

    const scannedKegiatanId = parts[1];
    const nik = parts[2];

    if (scannedKegiatanId !== kegiatanId) {
      toast.error('Peserta terdaftar di kegiatan lain');
      return;
    }

    try {
      // Find participant by NIK and kegiatanId
      const pQuery = query(collection(db, 'peserta'), where('kegiatan_id', '==', kegiatanId), where('nik', '==', nik));
      const pSnapshot = await getDocs(pQuery);
      
      if (pSnapshot.empty) {
        toast.error('Peserta tidak ditemukan');
        return;
      }

      await recordAbsensi(pSnapshot.docs[0].id);
    } catch (error: any) {
      toast.error('Gagal mencari peserta: ' + error.message);
    }
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Scan Absensi</h1>
          <p className="text-slate-500 mt-1">{kegiatan?.nama}</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-4">
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
          <button 
            onClick={() => {
              setScannerType('qr');
              if (scanning) stopScanner();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              scannerType === 'qr' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <QrCode className="w-4 h-4" /> QR Scanner
          </button>
          <button 
            onClick={() => {
              setScannerType('face');
              if (scanning) stopScanner();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              scannerType === 'face' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Face Scanner
          </button>
        </div>
        <button 
          onClick={() => setShowEventQR(true)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <QrCode className="w-5 h-5 text-green-600" />
          QR Check-in Mandiri
        </button>
      </div>

      {/* Event QR Modal */}
      <AnimatePresence>
        {showEventQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventQR(false)}
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
                  <QrCode className="w-6 h-6 text-green-600" />
                  QR Check-in Mandiri
                </h2>
                <button onClick={() => setShowEventQR(false)} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 flex flex-col items-center gap-6">
                <div ref={eventQrRef} className="p-6 bg-white border-4 border-slate-100 rounded-3xl shadow-inner">
                  <QRCodeSVG 
                    value={`${window.location.origin}/check-in/${kegiatanId}`}
                    size={240}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: APP_LOGO,
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="font-bold text-slate-800 text-lg">{kegiatan?.nama}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Peserta dapat melakukan check-in mandiri dengan men-scan QR ini menggunakan HP mereka.
                  </p>
                </div>

                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => {
                      const canvas = eventQrRef.current?.querySelector('svg');
                      if (canvas) {
                        const svgData = new XMLSerializer().serializeToString(canvas);
                        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
                        const url = URL.createObjectURL(svgBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `QR-Checkin-${kegiatan?.nama}.svg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Unduh QR
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Pilih Materi Sesi</label>
              <div className="relative">
                <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  disabled={scanning}
                  value={selectedMateri}
                  onChange={(e) => setSelectedMateri(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none disabled:opacity-50"
                >
                  {materi.map((m) => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
                  {materi.length === 0 && <option value="">Belum ada materi</option>}
                </select>
              </div>
            </div>

            {!scanning && scannerType === 'qr' ? (
              <button
                onClick={startScanner}
                disabled={!selectedMateri}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all flex flex-col items-center justify-center gap-3"
              >
                <Camera className="w-10 h-10" />
                <span>Mulai Scanning QR</span>
              </button>
            ) : scannerType === 'qr' ? (
              <div className="space-y-4">
                <div id="reader" className="overflow-hidden rounded-2xl border-2 border-green-500 bg-black aspect-square"></div>
                <button
                  onClick={stopScanner}
                  className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Berhenti Scanning
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <FaceScanner 
                  kegiatanId={kegiatanId!} 
                  onDetected={(pesertaId) => recordAbsensi(pesertaId)} 
                />
                <p className="text-xs text-slate-500 text-center italic">
                  Arahkan kamera ke wajah peserta untuk absensi otomatis
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-green-600" />
                Absensi Terakhir
              </h2>
            </div>
            <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
              {recentAbsensi.length > 0 ? recentAbsensi.map((a) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={a.id} 
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{a.peserta_nama}</div>
                      <div className="text-xs text-slate-500">{a.materi_nama}</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    {new Date(a.waktu).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </motion.div>
              )) : (
                <div className="p-10 text-center text-slate-400 text-sm italic">Belum ada absensi tercatat.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceScanner;
