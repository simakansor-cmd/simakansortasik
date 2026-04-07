import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { toast } from 'sonner';
import { APP_LOGO } from '../constants';
import { 
  User, 
  IdCard, 
  MapPin, 
  Phone, 
  Camera, 
  CheckCircle2, 
  Download,
  Calendar,
  Building2,
  ArrowRight,
  ChevronRight,
  Search,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const RegistrationPage = () => {
  const { user, isAdminUtama, isAdminPAC } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
    nama: '',
    nik: '',
    asal_pac: '',
    asal_ranting: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    pendidikan_terakhir: '',
    alamat: '',
    no_hp: '',
    email: '',
    pekerjaan: '',
    foto: ''
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [registeredPeserta, setRegisteredPeserta] = useState<any>(null);
  const idCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = 'kaderisasi';
    const q = query(collection(db, 'kaderisasi'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, foto: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return toast.error('Pilih kegiatan terlebih dahulu');
    
    setLoading(true);
    const path = 'peserta';
    try {
      const qrCode = `SIMAK-${selectedEvent.id}-${formData.nik}`;
      const docRef = await addDoc(collection(db, 'peserta'), {
        ...formData,
        kegiatan_id: selectedEvent.id,
        status_kelulusan: 'pending',
        qr_code: qrCode,
        created_at: new Date().toISOString()
      });
      
      setRegisteredPeserta({ id: docRef.id, ...formData, qr_code: qrCode });
      setStep(3);
      toast.success('Pendaftaran berhasil!');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  const downloadIDCard = async () => {
    if (!idCardRef.current) return;
    const canvas = await html2canvas(idCardRef.current, { 
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`ID_Card_${registeredPeserta.nama}.pdf`);
  };

  const handleFinish = () => {
    if (user && (isAdminUtama || isAdminPAC)) {
      navigate('/dashboard');
    } else {
      window.location.reload();
    }
  };

  return (
    <div className={user ? "py-4" : "min-h-screen bg-slate-50 py-12 px-4"}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          {user && (isAdminUtama || isAdminPAC) ? (
            <Link to="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-green-600 flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm transition-all">
              <LayoutDashboard className="w-4 h-4" /> Kembali ke Dashboard
            </Link>
          ) : (
            <div />
          )}
          {!user && (
            <Link to="/login" className="text-sm font-semibold text-green-600 hover:text-green-700 flex items-center gap-1 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm transition-all">
              Login Admin <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <div className="text-center mb-12">
          <img 
            src={APP_LOGO} 
            alt="Logo" 
            className="w-24 h-24 mx-auto mb-6 object-contain"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Pendaftaran Kaderisasi</h1>
          <p className="text-slate-500 mt-3 text-lg">GP Ansor Tasikmalaya</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12 gap-4">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                step >= i ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 'bg-white text-slate-400 border border-slate-200'
              }`}>
                {step > i ? <CheckCircle2 className="w-6 h-6" /> : i}
              </div>
              {i < 3 && <div className={`w-12 h-0.5 ${step > i ? 'bg-green-600' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-green-600" />
                  Pilih Kegiatan Kaderisasi
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.length > 0 ? events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`p-6 rounded-2xl border-2 text-left transition-all group ${
                        selectedEvent?.id === event.id 
                          ? 'border-green-500 bg-green-50 ring-4 ring-green-500/10' 
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="px-3 py-1 rounded-full bg-white text-green-700 text-xs font-bold uppercase tracking-wider border border-green-100">
                          {event.jenis}
                        </span>
                        <ChevronRight className={`w-5 h-5 transition-transform ${selectedEvent?.id === event.id ? 'text-green-600 translate-x-1' : 'text-slate-300'}`} />
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg mb-2">{event.nama}</h3>
                      <div className="space-y-2 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(event.tanggal), 'dd MMMM yyyy', { locale: id })}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {event.lokasi}
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {event.pac_name}
                        </div>
                      </div>
                    </button>
                  )) : (
                    <div className="col-span-2 py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      Belum ada kegiatan yang dibuka untuk pendaftaran.
                    </div>
                  )}
                </div>
                <div className="mt-10 flex justify-end">
                  <button
                    disabled={!selectedEvent}
                    onClick={() => setStep(2)}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    Lanjutkan <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <User className="w-6 h-6 text-green-600" />
                    Data Diri Peserta
                  </h2>
                  <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-green-600 font-medium">
                    Ganti Kegiatan
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Nama Lengkap</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.nama}
                          onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                          placeholder="Sesuai KTP"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">NIK (Nomor Induk Kependudukan)</label>
                      <div className="relative">
                        <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.nik}
                          onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                          placeholder="16 Digit NIK"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Asal PAC</label>
                        <input
                          type="text"
                          required
                          value={formData.asal_pac}
                          onChange={(e) => setFormData({ ...formData, asal_pac: e.target.value })}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                          placeholder="PAC Mana?"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Asal Ranting</label>
                        <input
                          type="text"
                          required
                          value={formData.asal_ranting}
                          onChange={(e) => setFormData({ ...formData, asal_ranting: e.target.value })}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                          placeholder="Ranting Mana?"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Tempat Lahir</label>
                        <input
                          type="text"
                          required
                          value={formData.tempat_lahir}
                          onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                          placeholder="Kota/Kab"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Tanggal Lahir</label>
                        <input
                          type="date"
                          required
                          value={formData.tanggal_lahir}
                          onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Pendidikan Terakhir</label>
                      <select
                        required
                        value={formData.pendidikan_terakhir}
                        onChange={(e) => setFormData({ ...formData, pendidikan_terakhir: e.target.value })}
                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      >
                        <option value="">Pilih Pendidikan</option>
                        <option value="SD">SD</option>
                        <option value="SMP">SMP</option>
                        <option value="SMA/SMK">SMA/SMK</option>
                        <option value="D3">D3</option>
                        <option value="S1">S1</option>
                        <option value="S2">S2</option>
                        <option value="S3">S3</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Nomor WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          required
                          value={formData.no_hp}
                          onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                          placeholder="0812xxxx"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Alamat Email Aktif</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                        placeholder="contoh@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Pekerjaan</label>
                      <input
                        type="text"
                        required
                        value={formData.pekerjaan}
                        onChange={(e) => setFormData({ ...formData, pekerjaan: e.target.value })}
                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                        placeholder="Pekerjaan saat ini"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Alamat Lengkap</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        <textarea
                          required
                          value={formData.alamat}
                          onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all min-h-[120px]"
                          placeholder="Alamat lengkap domisili"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Foto Formal</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="foto-upload"
                          required={!formData.foto}
                        />
                        <label 
                          htmlFor="foto-upload"
                          className="flex flex-col items-center justify-center w-full h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all overflow-hidden"
                        >
                          {formData.foto ? (
                            <img src={formData.foto} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Camera className="w-10 h-10 text-slate-300 mb-2" />
                              <span className="text-sm text-slate-500">Klik untuk upload foto</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-8 py-4 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? 'Mendaftarkan...' : <><CheckCircle2 className="w-5 h-5" /> Daftar Sekarang</>}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 3 && registeredPeserta && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Pendaftaran Berhasil!</h2>
                <p className="text-slate-500 mb-10 max-w-md mx-auto">
                  Selamat, Anda telah terdaftar sebagai peserta {selectedEvent.nama}. Silakan unduh ID Card Anda di bawah ini.
                </p>

                {/* ID Card Preview */}
                <div className="flex justify-center mb-10">
                  <div 
                    ref={idCardRef}
                    className="w-[380px] h-[580px] bg-white border border-slate-200 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative"
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
                          src={registeredPeserta.foto} 
                          alt={registeredPeserta.nama} 
                          className="w-full h-full object-cover" 
                          crossOrigin="anonymous"
                        />
                      </div>
                      
                      {/* Identity Info */}
                      <div className="space-y-2 mb-6 w-full">
                        <h4 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight text-center">
                          {registeredPeserta.nama}
                        </h4>
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-sm text-slate-500 font-bold text-center max-w-[280px]">
                            {selectedEvent.nama}
                          </p>
                          <span className="inline-flex items-center px-5 py-1.5 rounded-full bg-green-100 text-green-700 text-[11px] font-black uppercase tracking-[0.15em]">
                            {selectedEvent.jenis}
                          </span>
                        </div>
                      </div>
                      
                      {/* QR Code Section - Centered and Proportional */}
                      <div className="mt-auto flex flex-col items-center w-full">
                        <div className="bg-slate-50 p-5 rounded-[2.5rem] border-2 border-slate-100 shadow-inner flex items-center justify-center">
                          <QRCodeSVG 
                            value={registeredPeserta.qr_code} 
                            size={120} 
                            level="H" 
                            includeMargin={true} 
                          />
                        </div>
                        <div className="mt-4 flex flex-col items-center">
                          <span className="text-[11px] font-black text-slate-900 tracking-[0.25em] font-mono uppercase">
                            {registeredPeserta.qr_code}
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
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={downloadIDCard}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" /> Unduh ID Card (PDF)
                  </button>
                  <button
                    onClick={handleFinish}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-8 py-4 rounded-2xl font-bold transition-all"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RegistrationPage;
