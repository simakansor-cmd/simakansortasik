import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdminUtama: boolean;
  isAdminPAC: boolean;
  isPeserta: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdminUtama: false,
  isAdminPAC: false,
  isPeserta: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const path = `users/${user.uid}`;
      const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          // Force admin role for specific email
          if (user.email === 'adminsimak@simak.com' || user.email === 'kaderisasiansortasik@gmail.com') {
            setProfile({ ...data, role: 'admin_utama' });
          } else {
            setProfile(data);
          }
        } else {
          // If profile doesn't exist yet, but it's the admin email, create a temporary profile
          if (user.email === 'adminsimak@simak.com' || user.email === 'kaderisasiansortasik@gmail.com') {
            setProfile({ 
              uid: user.uid, 
              name: 'Admin Utama SIMAK', 
              email: user.email, 
              role: 'admin_utama' 
            });
          } else {
            setProfile(null);
          }
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        setLoading(false);
      });

      return () => unsubscribeProfile();
    }
  }, [user]);

  const value = {
    user,
    profile,
    loading,
    isAdminUtama: profile?.role === 'admin_utama',
    isAdminPAC: profile?.role === 'admin_pac',
    isPeserta: profile?.role === 'peserta',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
