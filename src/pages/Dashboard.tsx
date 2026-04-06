import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
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
  GraduationCap
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const Dashboard = () => {
  const { profile, isAdminUtama, isAdminPAC, isPeserta } = useAuth();
  const [stats, setStats] = useState({
    totalKaderisasi: 0,
    pendingKaderisasi: 0,
    totalPeserta: 0,
    totalLulus: 0
  });
  const [recentKaderisasi, setRecentKaderisasi] = useState<any[]>([]);
  const [myKaderisasi, setMyKaderisasi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

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
        
        // Fetch participants count
        let pesertaCount = 0;
        let lulusCount = 0;
        
        if (isAdminUtama) {
          const pSnapshot = await getDocs(collection(db, 'peserta'));
          pesertaCount = pSnapshot.size;
          lulusCount = pSnapshot.docs.filter(d => d.data().status_kelulusan === 'lulus').length;
        } else {
          // For PAC, only count participants in their events
          const eventIds = data.map(d => d.id);
          if (eventIds.length > 0) {
            const pQuery = query(collection(db, 'peserta'), where('kegiatan_id', 'in', eventIds));
            const pSnapshot = await getDocs(pQuery);
            pesertaCount = pSnapshot.size;
            lulusCount = pSnapshot.docs.filter(d => d.data().status_kelulusan === 'lulus').length;
          }
        }

        setStats({
          totalKaderisasi: total,
          pendingKaderisasi: pending,
          totalPeserta: pesertaCount,
          totalLulus: lulusCount
        });
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (isPeserta) {
      // For Peserta, show their registered events
      const fetchPesertaData = async () => {
        const pQuery = query(collection(db, 'peserta'), where('nik', '==', profile.email)); // Using email as NIK for demo or link them
        // Actually, better to have a way to link peserta to user
        // For now, let's just show a welcome message
        setLoading(false);
      };
      fetchPesertaData();
    }
  }, [profile, isAdminUtama, isAdminPAC, isPeserta]);

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data...</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Assalamu'alaikum, {profile?.name}</h1>
          <p className="text-slate-500 mt-1">Selamat datang di Dashboard SIMAK Ansor Tasikmalaya.</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                      item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.jenis.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 group-hover:text-green-700 transition-colors">{item.nama}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.lokasi}</span>
                        <span>•</span>
                        <span>{format(new Date(item.tanggal), 'dd MMMM yyyy', { locale: id })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      item.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status}
                    </span>
                    <Link to={`/participants/${item.id}`} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
                      <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-green-600" />
                    </Link>
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
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        <span className="text-sm text-slate-500 mt-1">{title}</span>
      </div>
    </motion.div>
  );
};

export default Dashboard;
