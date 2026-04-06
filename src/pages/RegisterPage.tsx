import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { APP_LOGO, padPassword } from '../constants';
import { UserPlus, Mail, Lock, User, Building } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin_pac' | 'peserta'>('peserta');
  const [pacName, setPacName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Auto-append @simak.com if no @ is present for username registration
    const trimmedEmail = email.trim();
    const finalEmail = trimmedEmail.includes('@') ? trimmedEmail : `${trimmedEmail}@simak.com`;
    
    try {
      // Check if user already exists in Firestore first (optional but good for UX)
      const q = query(collection(db, 'users'), where('email', '==', finalEmail));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        toast.error('Email atau Username sudah terdaftar. Silakan gunakan yang lain atau masuk.');
        setLoading(false);
        return;
      }

      const finalPassword = padPassword(password);
      const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, finalPassword);
      const user = userCredential.user;
      
      // Bootstrap admin role for specific emails
      const finalRole = (finalEmail === 'adminsimak@simak.com' || 
                         finalEmail === 'admin_utama@simak.com' || 
                         finalEmail === 'kaderisasiansortasik@gmail.com') 
        ? 'admin_utama' 
        : role;
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email: finalEmail,
        role: finalRole,
        pac_name: finalRole === 'admin_pac' ? pacName : null,
        created_at: new Date().toISOString()
      });
      
      toast.success('Pendaftaran berhasil!');
      navigate('/dashboard');
    } catch (error: any) {
      let errorMessage = 'Pendaftaran gagal: ' + error.message;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email atau Username sudah terdaftar. Silakan gunakan yang lain atau masuk.';
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-10"
      >
        <div className="text-center mb-10">
          <img 
            src={APP_LOGO} 
            alt="Logo" 
            className="w-20 h-20 mx-auto mb-4 object-contain"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-bold text-slate-900">Daftar Akun</h1>
          <p className="text-slate-500 mt-2">Buat akun SIMAK Ansor Tasikmalaya</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                placeholder="Nama Lengkap"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">Username / Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                placeholder="Username atau Email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">Daftar Sebagai</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('peserta')}
                className={`py-3 rounded-xl border font-medium transition-all ${
                  role === 'peserta' 
                    ? 'bg-green-50 border-green-500 text-green-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Peserta
              </button>
              <button
                type="button"
                onClick={() => setRole('admin_pac')}
                className={`py-3 rounded-xl border font-medium transition-all ${
                  role === 'admin_pac' 
                    ? 'bg-green-50 border-green-500 text-green-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Admin PAC
              </button>
            </div>
          </div>

          {role === 'admin_pac' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <label className="text-sm font-medium text-slate-700 ml-1">Nama PAC</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={pacName}
                  onChange={(e) => setPacName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                  placeholder="Contoh: PAC Cihideung"
                  required
                />
              </div>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-green-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          >
            {loading ? 'Memproses...' : <><UserPlus className="w-5 h-5" /> Daftar Akun</>}
          </button>
        </form>

        <p className="text-center mt-8 text-slate-600 text-sm">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-green-600 font-semibold hover:underline">
            Masuk
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
