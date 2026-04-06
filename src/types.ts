export type UserRole = 'admin_utama' | 'admin_pac' | 'peserta';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  pac_name?: string;
}

export interface Kaderisasi {
  id: string;
  nama: string;
  jenis: string;
  tanggal: string;
  lokasi: string;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string;
  pac_name: string;
  created_at: string;
}

export interface Materi {
  id: string;
  nama: string;
  kaderisasi_type: string;
}

export interface Peserta {
  id: string;
  nama: string;
  nik: string;
  alamat: string;
  no_hp: string;
  foto: string;
  kegiatan_id: string;
  status_kelulusan: 'pending' | 'lulus' | 'tidak_lulus';
  qr_code: string;
  created_at: string;
}

export interface Absensi {
  id: string;
  peserta_id: string;
  materi_id: string;
  kegiatan_id: string;
  waktu: string;
}
