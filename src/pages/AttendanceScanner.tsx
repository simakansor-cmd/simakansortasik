import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
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
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const AttendanceScanner = () => {
  const { kegiatanId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [materi, setMateri] = useState<any[]>([]);
  const [selectedMateri, setSelectedMateri] = useState<string>('');
  const [recentAbsensi, setRecentAbsensi] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!kegiatanId) return;

    const fetchKegiatan = async () => {
      const docRef = doc(db, 'kaderisasi', kegiatanId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
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
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [kegiatanId]);

  const startScanner = () => {
    if (!selectedMateri) return toast.error('Pilih materi terlebih dahulu');
    setScanning(true);
    
    // Give a small delay for the DOM to render the reader div
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader", 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().then(() => {
        setScanning(false);
        scannerRef.current = null;
      }).catch(err => {
        console.error("Failed to clear scanner", err);
        setScanning(false);
      });
    } else {
      setScanning(false);
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

      const peserta = pSnapshot.docs[0];
      const pesertaId = peserta.id;

      // Check if already absensi for this materi
      const aQuery = query(collection(db, 'absensi'), 
        where('peserta_id', '==', pesertaId), 
        where('materi_id', '==', selectedMateri)
      );
      const aSnapshot = await getDocs(aQuery);
      
      if (!aSnapshot.empty) {
        toast.warning(`${peserta.data().nama} sudah absen untuk materi ini`);
        return;
      }

      // Record absensi
      await addDoc(collection(db, 'absensi'), {
        peserta_id: pesertaId,
        materi_id: selectedMateri,
        kegiatan_id: kegiatanId,
        waktu: new Date().toISOString()
      });

      toast.success(`Absensi berhasil: ${peserta.data().nama}`);
      
      // Stop scanner briefly to show success or just continue
      // stopScanner();
    } catch (error: any) {
      toast.error('Gagal mencatat absensi: ' + error.message);
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

            {!scanning ? (
              <button
                onClick={startScanner}
                disabled={!selectedMateri}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all flex flex-col items-center justify-center gap-3"
              >
                <Camera className="w-10 h-10" />
                <span>Mulai Scanning</span>
              </button>
            ) : (
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
