import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { 
  QrCode, 
  UserCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APP_LOGO } from '../constants';

const CheckInPage = () => {
  const { kegiatanId } = useParams();
  const navigate = useNavigate();
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [nik, setNik] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pesertaData, setPesertaData] = useState<any>(null);

  useEffect(() => {
    const fetchKegiatan = async () => {
      if (!kegiatanId) return;
      try {
        const docRef = doc(db, 'kaderisasi', kegiatanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setKegiatan({ id: docSnap.id, ...docSnap.data() });
        } else {
          toast.error('Kegiatan tidak ditemukan');
          navigate('/');
        }
      } catch (error) {
        console.error("Error fetching kegiatan:", error);
      }
    };
    fetchKegiatan();
  }, [kegiatanId]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kegiatanId || !nik) return;

    setLoading(true);
    try {
      // Find participant by NIK and kegiatanId
      const pQuery = query(collection(db, 'peserta'), 
        where('kegiatan_id', '==', kegiatanId), 
        where('nik', '==', nik)
      );
      const pSnapshot = await getDocs(pQuery);

      if (pSnapshot.empty) {
        toast.error('NIK tidak terdaftar untuk kegiatan ini');
        setLoading(false);
        return;
      }

      const pesertaDoc = pSnapshot.docs[0];
      const pesertaId = pesertaDoc.id;
      const data = pesertaDoc.data();

      // Update status to 'Peserta'
      await updateDoc(doc(db, 'peserta', pesertaId), {
        status: 'Peserta'
      });

      // Record initial attendance if needed (optional, or just status change)
      // For now, we just change status as requested.

      setPesertaData(data);
      setSuccess(true);
      toast.success('Check-in berhasil!');
    } catch (error: any) {
      toast.error('Gagal check-in: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100"
      >
        <div className="p-8 text-center bg-green-600 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <QrCode className="w-64 h-64 -rotate-12 -translate-x-10 -translate-y-10" />
          </div>
          
          <img src={APP_LOGO} alt="Logo" className="w-20 h-20 mx-auto mb-4 relative z-10 drop-shadow-lg" />
          <h1 className="text-2xl font-black tracking-tight relative z-10">CHECK-IN MANDIRI</h1>
          <p className="text-green-100 text-sm font-medium relative z-10 opacity-90">{kegiatan?.nama || 'Memuat...'}</p>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form 
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleCheckIn} 
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Masukkan NIK Anda</label>
                  <div className="relative">
                    <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={nik}
                      onChange={(e) => setNik(e.target.value)}
                      placeholder="16 digit NIK"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1 italic">
                    *Gunakan NIK yang Anda gunakan saat mendaftar.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !kegiatan}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Check-in Sekarang
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-4"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900">Berhasil!</h2>
                  <p className="text-slate-500">
                    Selamat datang, <span className="font-bold text-slate-800">{pesertaData?.nama}</span>. 
                    Status Anda kini telah berubah menjadi <span className="text-green-600 font-bold">Peserta</span>.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kegiatan</div>
                  <div className="text-sm font-bold text-slate-700">{kegiatan?.nama}</div>
                  <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lokasi</div>
                  <div className="text-sm font-medium text-slate-600">{kegiatan?.lokasi}</div>
                </div>

                <button
                  onClick={() => navigate('/')}
                  className="w-full py-4 text-slate-500 font-bold hover:text-slate-700 transition-all"
                >
                  Kembali ke Beranda
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="mt-8 flex items-center gap-2 text-slate-400 text-xs">
        <AlertCircle className="w-4 h-4" />
        <span>Pastikan Anda berada di lokasi pelatihan saat melakukan check-in.</span>
      </div>
    </div>
  );
};

export default CheckInPage;
