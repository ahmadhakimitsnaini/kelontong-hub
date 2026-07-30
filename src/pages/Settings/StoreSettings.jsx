import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Users,
  UserPlus,
  Trash2,
  Shield,
  User,
  Mail,
  Edit3,
  Check,
  X,
  Loader2,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/useAuthStore';

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA: STORE SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────

const StoreSettings = () => {
  const { user } = useAuthStore();
  const storeId   = user?.store_id;
  const storeName = user?.store_name;
  const storeRole = user?.store_role;
  const isOwner   = storeRole === 'owner';

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [members,       setMembers]       = useState([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [inviteEmail,   setInviteEmail]   = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError,   setInviteError]   = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [editingName,   setEditingName]   = useState(false);
  const [newStoreName,  setNewStoreName]  = useState(storeName || 'Warung Saya');
  const [savingName,    setSavingName]    = useState(false);
  const [copied,        setCopied]        = useState(false);

  // ── FETCH ANGGOTA ──────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      // Ambil semua anggota store ini
      const { data: memberData, error: memberErr } = await supabase
        .from('store_members')
        .select('id, user_id, role, joined_at')
        .eq('store_id', storeId)
        .order('joined_at', { ascending: true });

      if (memberErr) throw memberErr;

      // Ambil profil untuk semua user_id yang ada
      const userIds = memberData.map(m => m.user_id);
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .in('id', userIds);

      // Gabungkan data member dengan profil
      const combined = (memberData || []).map(m => ({
        ...m,
        full_name: profileData?.find(p => p.id === m.user_id)?.full_name || 'Pengguna',
        app_role:  profileData?.find(p => p.id === m.user_id)?.role || m.role,
      }));

      setMembers(combined);
    } catch (err) {
      console.error('[StoreSettings] Gagal memuat anggota:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ── SALIN STORE ID ─────────────────────────────────────────────────────────
  const handleCopyStoreId = () => {
    if (!storeId) return;
    navigator.clipboard.writeText(storeId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── UBAH NAMA WARUNG ───────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!newStoreName.trim() || !storeId) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ nama_warung: newStoreName.trim() })
        .eq('id', storeId);

      if (error) throw error;

      // Update state lokal
      useAuthStore.setState(s => ({
        user: { ...s.user, store_name: newStoreName.trim() }
      }));
      setEditingName(false);
    } catch (err) {
      console.error('[StoreSettings] Gagal mengubah nama warung:', err.message);
    } finally {
      setSavingName(false);
    }
  };

  // ── TAMBAH ANGGOTA BY EMAIL ────────────────────────────────────────────────
  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !storeId) return;

    setInviteLoading(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      // 1. Cari user_id berdasarkan email menggunakan helper function
      const { data: foundUserId, error: lookupErr } = await supabase
        .rpc('get_user_id_by_email', { lookup_email: email });

      if (lookupErr || !foundUserId) {
        setInviteError(`Email "${email}" tidak ditemukan. Pastikan kasir sudah pernah login ke aplikasi ini.`);
        return;
      }

      // 2. Pastikan belum menjadi anggota
      const alreadyMember = members.some(m => m.user_id === foundUserId);
      if (alreadyMember) {
        setInviteError('Pengguna ini sudah menjadi anggota warung.');
        return;
      }

      // 3. Cegah menambahkan diri sendiri
      if (foundUserId === user?.id) {
        setInviteError('Anda tidak bisa menambahkan diri sendiri.');
        return;
      }

      // 4. Tambahkan ke store_members
      const { error: insertErr } = await supabase
        .from('store_members')
        .insert({
          store_id:   storeId,
          user_id:    foundUserId,
          role:       'kasir',
          invited_by: user?.id,
        });

      if (insertErr) throw insertErr;

      setInviteSuccess(`Berhasil! Kasir dengan email "${email}" telah ditambahkan ke warung ini. Mereka akan mendapatkan data warung saat login berikutnya.`);
      setInviteEmail('');
      fetchMembers(); // Refresh daftar anggota
    } catch (err) {
      setInviteError(`Gagal menambahkan anggota: ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  // ── HAPUS ANGGOTA ──────────────────────────────────────────────────────────
  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Yakin ingin mengeluarkan "${memberName}" dari warung ini?`)) return;

    try {
      const { error } = await supabase
        .from('store_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      fetchMembers();
    } catch (err) {
      console.error('[StoreSettings] Gagal hapus anggota:', err.message);
      alert('Gagal mengeluarkan anggota. Coba lagi.');
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 lg:px-8 pt-6 pb-5 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <Store className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Anggota Toko</h1>
            <p className="text-sm text-gray-500 mt-0.5">Kelola pengguna yang memiliki akses ke warung ini</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-2xl mx-auto w-full space-y-6">

        {/* ── KARTU INFO WARUNG ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Store className="w-4 h-4 text-primary-500" />
            Informasi Warung
          </h2>

          {/* Nama Warung */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nama Warung
            </label>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="text"
                  value={newStoreName}
                  onChange={e => setNewStoreName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="p-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNewStoreName(storeName || 'Warung Saya'); }}
                  className="p-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-lg font-bold text-gray-900">{storeName || 'Warung Saya'}</p>
                {isOwner && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Store ID */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              ID Warung
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <p className="flex-1 text-xs text-gray-400 font-mono bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 truncate">
                {storeId || '—'}
              </p>
              <button
                onClick={handleCopyStoreId}
                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex-shrink-0"
                title="Salin ID Warung"
              >
                {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Bagikan ID ini jika diperlukan untuk keperluan teknis</p>
          </div>
        </div>

        {/* ── KARTU TAMBAH ANGGOTA (OWNER ONLY) ──────────────────────────── */}
        {isOwner && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary-500" />
              Tambah Kasir
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Masukkan email akun kasir yang sudah terdaftar di aplikasi ini.
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteError(''); setInviteSuccess(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="email@kasir.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-gray-50"
                />
              </div>
              <button
                onClick={handleInvite}
                disabled={inviteLoading || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {inviteLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <UserPlus className="w-4 h-4" />
                }
                Tambahkan
              </button>
            </div>

            {inviteError && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{inviteError}</p>
              </div>
            )}
            {inviteSuccess && (
              <div className="mt-3 flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{inviteSuccess}</p>
              </div>
            )}
          </div>
        )}

        {/* ── KARTU DAFTAR ANGGOTA ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              Anggota Warung
            </h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
              {members.length} anggota
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto opacity-20 mb-3" />
              <p>Belum ada anggota</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {members.map(member => {
                const isCurrentUser = member.user_id === user?.id;
                const isOwnerMember = member.role === 'owner';
                const joinedDate    = new Date(member.joined_at).toLocaleDateString('id-ID', {
                  day: '2-digit', month: 'short', year: 'numeric'
                });

                return (
                  <div key={member.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/50">
                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isOwnerMember ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {isOwnerMember
                          ? <Shield className="w-5 h-5 text-amber-600" />
                          : <User   className="w-5 h-5 text-blue-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 truncate">{member.full_name}</p>
                          {isCurrentUser && (
                            <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isOwnerMember
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isOwnerMember ? 'Owner' : 'Kasir'}
                          </span>
                          <span className="text-xs text-gray-400">Bergabung {joinedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Aksi Hapus (Owner only, tidak bisa hapus diri sendiri) */}
                    {isOwner && !isCurrentUser && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.full_name)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0"
                        title={`Keluarkan ${member.full_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Catatan Informasi */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">ℹ️ Cara menambah kasir ke warung ini:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600">
            <li>Pastikan kasir sudah pernah login ke aplikasi minimal sekali</li>
            <li>Masukkan email akun kasir di form "Tambah Kasir" di atas</li>
            <li>Kasir akan otomatis melihat data warung ini saat login berikutnya</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default StoreSettings;
