import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, CheckCircle2, Loader2, AlertCircle, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadFaceApiModels, getFaceDescriptor, compareFaces } from '../lib/faceApi';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface FaceScannerProps {
  kegiatanId: string;
  onDetected: (pesertaId: string) => void;
}

const FaceScanner: React.FC<FaceScannerProps> = ({ kegiatanId, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [lastDetectedId, setLastDetectedId] = useState<string | null>(null);
  const [detectionActive, setDetectionActive] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceApiModels();
        await fetchParticipants();
        await startCamera();
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize face scanner:', err);
        setError('Gagal memuat sistem pengenalan wajah.');
        setLoading(false);
      }
    };

    init();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const fetchParticipants = async () => {
    const q = query(
      collection(db, 'peserta'), 
      where('kegiatan_id', '==', kegiatanId),
      where('face_descriptor', '!=', null)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setParticipants(data);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'environment' // Use back camera for scanning others
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Gagal mengakses kamera.');
    }
  };

  // Continuous scanning loop
  useEffect(() => {
    let interval: any;
    if (!loading && !error && detectionActive) {
      interval = setInterval(async () => {
        if (videoRef.current && !scanning) {
          await performDetection();
        }
      }, 1500); // Scan every 1.5 seconds
    }
    return () => clearInterval(interval);
  }, [loading, error, scanning, detectionActive, participants]);

  const performDetection = async () => {
    if (!videoRef.current || participants.length === 0) return;

    setScanning(true);
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      
      if (descriptor) {
        // Compare with all participants
        for (const p of participants) {
          if (p.face_descriptor && compareFaces(descriptor, p.face_descriptor)) {
            if (p.id !== lastDetectedId) {
              setLastDetectedId(p.id);
              onDetected(p.id);
              setDetectionActive(false);
              // Reactivate after 3 seconds to prevent double detection
              setTimeout(() => {
                setDetectionActive(true);
                setLastDetectedId(null);
              }, 3000);
            }
            break;
          }
        }
      }
    } catch (err) {
      console.error('Detection error:', err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800">
      {loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
          <p className="text-sm font-medium opacity-80">Menyiapkan Kamera Wajah...</p>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 text-white">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="font-medium">{error}</p>
          <button 
            onClick={startCamera}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover"
          />
          
          {/* Scanning Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-[40px] border-black/40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-green-500/50 rounded-3xl">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-xl" />
              
              {scanning && (
                <motion.div 
                  initial={{ top: '0%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]"
                />
              )}
            </div>
          </div>

          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
              <div className={`w-2 h-2 rounded-full ${detectionActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                {detectionActive ? 'Face Detection Active' : 'Processing...'}
              </span>
            </div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                {participants.length} Terdaftar
              </span>
            </div>
          </div>

          {!detectionActive && (
            <div className="absolute inset-0 bg-green-600/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-6 rounded-full shadow-2xl mb-4"
              >
                <UserCheck className="w-12 h-12 text-green-600" />
              </motion.div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Wajah Dikenali!</h3>
              <p className="text-sm font-bold opacity-90">Absensi berhasil dicatat</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FaceScanner;
