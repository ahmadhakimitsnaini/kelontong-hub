import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { LogIn, Store, Loader2 } from "lucide-react";
import useAuthStore from "../../store/useAuthStore";
import useNotificationStore from "../../store/useNotificationStore";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { login, isLoggedIn, isInitialized, resendVerificationEmail } = useAuthStore();
  const { showAlert } = useNotificationStore();

  // Jika belum selesai inisialisasi sesi, tampilkan layar loading kosong
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Jika sudah login, langsung arahkan ke Dashboard (atau POS sesuai role nanti)
  if (isLoggedIn()) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showAlert("Email dan Password wajib diisi.", "error");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    const { success, error } = await login(email, password);
    setIsSubmitting(false);

    if (success) {
      showAlert("Login berhasil!", "success");
      setShowResend(false);
      setErrorMsg("");
      // Navigasi akan tertangani otomatis oleh kondisi isLoggedIn() di atas
    } else {
      showAlert(error, "error");
      setErrorMsg(error);
      if (error.includes("belum dikonfirmasi")) {
        setShowResend(true);
      } else {
        setShowResend(false);
      }
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    setErrorMsg("");
    const { success, error } = await resendVerificationEmail(email);
    setIsSubmitting(false);
    if (success) {
      showAlert("Email verifikasi telah dikirim ulang. Silakan cek inbox/spam Anda.", "success");
      setShowResend(false);
      setErrorMsg("");
    } else {
      showAlert(error, "error");
      setErrorMsg(error);
    }
  };

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
          Sistem Manajemen Kasir & Inventaris
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 text-center">
              Masuk ke Akun
            </h3>
            <p className="text-sm text-gray-500 text-center mt-1">
              Gunakan kredensial Anda untuk melanjutkan
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Alamat Email
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Kata Sandi
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Masuk Sekarang
                  </>
                )}
              </button>
            </div>
            {showResend && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-2 px-4 border border-primary-300 rounded-xl shadow-sm text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Kirim Ulang Email Verifikasi
                </button>
              </div>
            )}

          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">Toko Podjok</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
