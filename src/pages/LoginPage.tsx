import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { APP_LOGO, padPassword } from '../constants';
import { LogIn, Mail, Lock, Chrome } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Auto-append @simak.com if no @ is present for username login
    const trimmedEmail = email.trim();
    const finalEmail = trimmedEmail.includes('@') ? trimmedEmail : `${trimmedEmail}@simak.com`;
    
    try {
      console.log('Attempting login with:', finalEmail);
      const finalPassword = padPassword(password);
      await signInWithEmailAndPassword(auth, finalEmail, finalPassword);
      toast.success('Login berhasil!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error.code, error.message);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        toast.error('Username atau Password salah. Pastikan Anda sudah terdaftar.');
      } else {
        toast.error('Gagal masuk: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // Bootstrap admin role for specific emails
        const finalRole = (user.email === 'adminsimak@simak.com' || 
                           user.email === 'admin_utama@simak.com' || 
                           user.email === 'kaderisasiansortasik@gmail.com') 
          ? 'admin_utama' 
          : 'peserta';

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName || 'User',
          email: user.email,
          role: finalRole,
          created_at: new Date().toISOString()
        });
      }
      
      toast.success('Login berhasil!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error('Login Google gagal: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-10"
      >
        <div className="text-center mb-10">
          <img 
            src={APP_LOGO} 
            alt="Logo" 
            className="w-20 h-20 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-900">SIMAK Ansor</h1>
          <p className="text-slate-500 mt-2">Sistem Informasi Manajemen Kaderisasi</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
            <p className="text-[10px] text-blue-700 leading-relaxed">
              <strong>Info Peserta:</strong> Jika Anda sudah mendaftar, silakan login menggunakan <strong>Email</strong> sebagai username dan <strong>NIK</strong> sebagai password.
            </p>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-green-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Memproses...' : <><LogIn className="w-5 h-5" /> Masuk</>}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-slate-500">Atau masuk dengan</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-3"
        >
          <Chrome className="w-5 h-5 text-blue-500" />
          Google Account
        </button>

        <p className="text-center mt-8 text-slate-600 text-sm">
          Belum punya akun?{' '}
          <Link to="/register" className="text-green-600 font-semibold hover:underline">
            Daftar Sekarang
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
