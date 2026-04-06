import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardCheck, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  ShieldCheck,
  Building2,
  UserPlus,
  UserCog
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { APP_LOGO } from '../constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isAdminUtama, isAdminPAC } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, show: true },
    { name: 'Kaderisasi', path: '/kaderisasi', icon: Building2, show: isAdminUtama || isAdminPAC },
    { name: 'Daftar Peserta', path: '/participants', icon: Users, show: isAdminUtama || isAdminPAC },
    { name: 'Absensi', path: '/absensi', icon: ClipboardCheck, show: isAdminUtama || isAdminPAC },
    { name: 'Form Pendaftaran', path: '/', icon: UserPlus, show: isAdminUtama || isAdminPAC },
    { name: 'Kelola Akun', path: '/accounts', icon: UserCog, show: isAdminUtama },
  ];

  const filteredNavItems = navItems.filter(item => item.show);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img 
            src={APP_LOGO} 
            alt="Logo" 
            className="w-10 h-10 object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 leading-tight">SIMAK</span>
            <span className="text-xs text-slate-500">Ansor Tasikmalaya</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                location.pathname === item.path 
                  ? "bg-green-50 text-green-700 font-medium" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5",
                location.pathname === item.path ? "text-green-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {item.name}
              {location.pathname === item.path && (
                <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-green-600" />
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm">
              {profile?.name?.charAt(0)}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-slate-800 truncate">{profile?.name}</span>
              <span className="text-xs text-slate-500 truncate capitalize">{profile?.role?.replace('_', ' ')}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-200"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img 
            src={APP_LOGO} 
            alt="Logo" 
            className="w-8 h-8 object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="font-bold text-slate-800">SIMAK</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 md:hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src={APP_LOGO} 
                    alt="Logo" 
                    className="w-10 h-10 object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-bold text-slate-800">SIMAK</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {filteredNavItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                      location.pathname === item.path 
                        ? "bg-green-50 text-green-700 font-medium" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5",
                      location.pathname === item.path ? "text-green-600" : "text-slate-400"
                    )} />
                    {item.name}
                  </Link>
                ))}
              </nav>
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-200"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-16" /> {/* Spacer for mobile header */}
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
