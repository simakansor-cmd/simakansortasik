import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, getDocs, getCountFromServer, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  QrCode, 
  Building2, 
  Calendar, 
  MapPin, 
  ChevronRight,
  Search,
  Clock,
  Settings,
  Save,
  BarChart3,
  Users,
  BookOpen,
  ClipboardCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

const KaderisasiStatRow = ({ item, materiList, isAdminPAC }: { item: any; materiList: any[]; isAdminPAC: boolean }) => {
  const [stats, setStats] = useState({
    pesertaCount: 0,
    totalAbsensi: 0,
    materiCount: 0,
    avgAttendance: 0,
    loading: true
  });

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const eventMateri = materiList.filter(m => m.kaderisasi_type === item.jenis);
        const materiCount = eventMateri.length;

        const pQuery = query(collection(db, 'peserta'), where('kegiatan_id', '==', item.id));
        const aQuery = query(collection(db, 'absensi'), where('kegiatan_id', '==', item.id));

        const [pSnapshot, aSnapshot] = await Promise.all([
          getCountFromServer(pQuery),
          getCountFromServer(aQuery)
        ]);

        if (isMounted) {
          const pesertaCount = pSnapshot.data().count;
          const totalAbsensi = aSnapshot.data().count;

          setStats({
            pesertaCount,
            totalAbsensi,
            materiCount,
            avgAttendance: materiCount > 0 && pesertaCount > 0 
              ? Math.round((totalAbsensi / (materiCount * pesertaCount)) * 100) 
              : 0,
            loading: false
          });
        }
      } catch (error) {
        console.error("Error fetching stats for", item.nama, error);
        if (isMounted) setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, [item.id, item.jenis, materiList]);

  return (
    <div className="p-6 hover:bg-slate-50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-6 group">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center font-bold text-xl">
          {item.jenis.charAt(0)}
        </div>
        <div>
          <h3 className="font-bold text-slate-800 group-hover:text-green-700 transition-colors text-lg">{item.nama}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.lokasi}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {format(new Date(item.tanggal), 'dd MMM yyyy', { locale: id })}</span>
            <span className="flex items-center gap-1 font-bold text-green-600"><Building2 className="w-3.5 h-3.5" /> {item.pac_name}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Materi</div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-slate-700">{stats.materiCount}</span>
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Peserta</div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-slate-700">{stats.loading ? '...' : stats.pesertaCount}</span>
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Absen</div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-green-500" />
            <span className="font-bold text-slate-700">{stats.loading ? '...' : stats.totalAbsensi}</span>
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Rata-rata</div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-slate-700">{stats.loading ? '...' : stats.avgAttendance}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isAdminPAC && (
          <Link 
            to={`/scan/${item.id}`}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <QrCode className="w-5 h-5" />
            Scan
          </Link>
        )}
        <Link 
          to={`/participants/${item.id}`}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all"
          title="Lihat Detail Rekap"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
};

const AttendancePage = () => {
  const { profile, isAdminUtama, isAdminPAC } = useAuth();
  const [kaderisasiList, setKaderisasiList] = useState<any[]>([]);
  const [materiList, setMateriList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradConfig, setGradConfig] = useState({ min_attendance: 75 });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Fetch Graduation Config
    const fetchConfig = async () => {
      const docRef = doc(db, 'settings', 'graduation');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setGradConfig(docSnap.data() as any);
      } else {
        // Initialize default if not exists
        await setDoc(docRef, { min_attendance: 75 });
      }
    };
    fetchConfig();

    let q;
    if (isAdminUtama) {
      q = query(collection(db, 'kaderisasi'), where('status', '==', 'approved'), orderBy('tanggal', 'desc'), limit(100));
    } else {
      q = query(collection(db, 'kaderisasi'), 
        where('created_by', '==', profile.uid),
        where('status', '==', 'approved'),
        orderBy('tanggal', 'desc'),
        limit(50)
      );
    }

    const unsubscribeKaderisasi = onSnapshot(q, (snapshot) => {
      setKaderisasiList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeMateri = onSnapshot(collection(db, 'materi'), (snapshot) => {
      setMateriList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeKaderisasi();
      unsubscribeMateri();
    };
  }, [profile, isAdminUtama]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, 'settings', 'graduation'), gradConfig);
      toast.success('Konfigurasi kelulusan diperbarui');
    } catch (error: any) {
      toast.error('Gagal memperbarui konfigurasi: ' + error.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const filteredList = kaderisasiList.filter(item => 
    item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.lokasi.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64">Memuat data...</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Absensi & Rekapitulasi</h1>
        <p className="text-slate-500 mt-1">
          {isAdminUtama ? 'Monitoring absensi seluruh kegiatan dan konfigurasi kelulusan.' : 'Pilih kegiatan untuk memulai scanning absensi.'}
        </p>
      </header>

      {isAdminUtama && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Konfigurasi Kelulusan</h2>
              <p className="text-sm text-slate-500">Tentukan batas minimum kehadiran peserta.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <span className="text-sm font-bold text-slate-700">Min. Kehadiran:</span>
              <input 
                type="number" 
                min="0"
                max="100"
                value={gradConfig.min_attendance}
                onChange={(e) => setGradConfig({ ...gradConfig, min_attendance: parseInt(e.target.value) || 0 })}
                className="w-16 bg-transparent text-center font-bold text-green-600 outline-none"
              />
              <span className="text-sm font-bold text-slate-400">%</span>
            </div>
            <button 
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Simpan
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari kegiatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {filteredList.length > 0 ? filteredList.map((item) => (
            <KaderisasiStatRow 
              key={item.id} 
              item={item} 
              materiList={materiList} 
              isAdminPAC={isAdminPAC === true} 
            />
          )) : (
            <div className="p-12 text-center text-slate-500">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-slate-300" />
              </div>
              <p>Tidak ada kegiatan yang disetujui untuk absensi.</p>
              {isAdminPAC && (
                <p className="text-sm mt-2">Pastikan pengajuan kaderisasi Anda sudah disetujui oleh Admin Utama.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
