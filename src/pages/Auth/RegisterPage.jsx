import React, { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { UserPlus, Store, Loader2 } from "lucide-react";
import useAuthStore from "../../store/useAuthStore";
import useNotificationStore from "../../store/useNotificationStore";

const RegisterPage = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { register, isLoggedIn, isInitialized } = useAuthStore();
  const { showAlert } = useNotificationStore();
  const navigate = useNavigate();

  // Jika belum selesai inisialisasi sesi, tampilkan layar loading kosong
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Jika sudah login, langsung arahkan ke Dashboard
  if (isLoggedIn()) {
    return <Navigate to="/" replace />;
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      showAlert("Semua kolom wajib diisi.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Kata sandi dan konfirmasi kata sandi tidak cocok.", "error");
      return;
    }

    if (password.length < 6) {
      showAlert("Kata sandi minimal 6 karakter.", "error");
      return;
    }

    setIsSubmitting(true);
    const { success, error } = await register(email, password, fullName);
    setIsSubmitting(false);

    if (success) {
      setIsSuccess(true);
      showAlert("Pendaftaran berhasil! Silakan periksa email Anda.", "success");
    } else {
      showAlert(error, "error");
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-96 bg-primary-600 rounded-b-[4rem] sm:rounded-b-[8rem] shadow-xl transform -translate-y-12"></div>
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
          <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Registrasi Berhasil!</h3>
            <p className="text-gray-600 mb-6">
              Kami telah mengirimkan email verifikasi ke <strong>{email}</strong>. 
              Silakan periksa kotak masuk atau folder spam Anda dan klik tautan untuk mengaktifkan akun.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none transition-all"
            >
              Kembali ke Halaman Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ornamen */}
      <div className="absolute top-0 left-0 w-full h-96 bg-primary-600 rounded-b-[4rem] sm:rounded-b-[8rem] shadow-xl transform -translate-y-12"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center">
            <Store className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Toko Podjok
        </h2>
        <p className="mt-2 text-center text-sm text-primary-100">
          Pendaftaran Akun Baru
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100">
          
          <form className="space-y-5" onSubmit={handleRegister}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Budi Santoso"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Alamat Email</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="admin@tokopodjok.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Kata Sandi</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Min. 6 karakter"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Konfirmasi Kata Sandi</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Ulangi kata sandi"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Mendaftarkan...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Daftar Sekarang
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              Sudah punya akun?{" "}
              <Link to="/login" className="font-bold text-primary-600 hover:text-primary-500">
                Masuk di sini
              </Link>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
