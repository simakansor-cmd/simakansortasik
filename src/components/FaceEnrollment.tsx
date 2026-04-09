import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadFaceApiModels, getFaceDescriptor } from '../lib/faceApi';
import { toast } from 'sonner';

interface FaceEnrollmentProps {
  onComplete: (descriptor: number[]) => void;
  onBack: () => void;
  userName: string;
}

const FaceEnrollment: React.FC<FaceEnrollmentProps> = ({ onComplete, onBack, userName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceApiModels();
        await startCamera();
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize face enrollment:', err);
        setError('Gagal memuat sistem pengenalan wajah. Pastikan izin kamera diberikan.');
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

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Gagal mengakses kamera. Pastikan kamera tidak digunakan aplikasi lain.');
    }
  };

  const captureFace = async () => {
    if (!videoRef.current || scanning) return;

    setScanning(true);
    setError(null);

    try {
      // Wait a bit for the video to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const faceDescriptor = await getFaceDescriptor(videoRef.current);
      
      if (faceDescriptor) {
        setDescriptor(faceDescriptor);
        toast.success('Wajah berhasil dikenali!');
      } else {
        setError('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan pencahayaan cukup.');
      }
    } catch (err) {
      console.error('Error capturing face:', err);
      setError('Terjadi kesalahan saat memproses wajah.');
    } finally {
      setScanning(false);
    }
  };

  const handleComplete = () => {
    if (descriptor) {
      onComplete(descriptor);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Pendaftaran Wajah</h2>
        <p className="text-slate-500">Halo {userName}, silakan daftarkan wajah Anda untuk fitur absensi otomatis.</p>
      </div>

      <div className="relative max-w-md mx-auto aspect-video bg-slate-100 rounded-2xl overflow-hidden border-4 border-slate-50 shadow-inner mb-8">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Memuat sistem...</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-slate-600 font-medium">{error}</p>
            <button 
              onClick={startCamera}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-sm font-bold transition-all"
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
            <canvas ref={canvasRef} className="hidden" />
            
            {scanning && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white font-bold drop-shadow-md">Memproses...</span>
                </div>
              </div>
            )}

            {descriptor && !scanning && (
              <div className="absolute inset-0 bg-green-600/20 flex items-center justify-center">
                <div className="bg-white p-4 rounded-full shadow-xl">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {!descriptor ? (
          <button
            disabled={loading || scanning || !!error}
            onClick={captureFace}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            Ambil Data Wajah
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setDescriptor(null)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Ulangi
            </button>
            <button
              onClick={handleComplete}
              className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all flex items-center justify-center gap-2"
            >
              Simpan & Selesai
            </button>
          </div>
        )}
        
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-slate-600 font-medium text-sm transition-all"
        >
          Kembali ke Form
        </button>
      </div>

      <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">Tips Pengenalan Wajah:</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-80">
            <li>Pastikan wajah berada di tengah bingkai</li>
            <li>Cari tempat dengan pencahayaan yang terang</li>
            <li>Lepas kacamata hitam atau masker jika ada</li>
            <li>Tetap tenang dan jangan banyak bergerak saat pengambilan</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollment;
