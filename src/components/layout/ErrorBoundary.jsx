import React from 'react';
import { Store } from 'lucide-react';

/**
 * ErrorBoundary — Jaring pengaman terakhir untuk menangkap runtime error React.
 *
 * Tanpa komponen ini, error pada SATU komponen child akan meng-unmount
 * SELURUH pohon React dan menghasilkan layar putih kosong (White Screen of Death).
 *
 * Dengan ErrorBoundary, user akan melihat halaman fallback yang informatif
 * dan bisa melakukan reload untuk memulihkan aplikasi.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
            fontFamily: "'Outfit', sans-serif",
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
            }}
          >
            <Store style={{ width: 32, height: 32, color: '#ffffff' }} />
          </div>

          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: 8,
            }}
          >
            Terjadi Kesalahan
          </h2>

          <p
            style={{
              fontSize: 14,
              color: '#6b7280',
              maxWidth: 400,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            Aplikasi mengalami kendala teknis. Silakan muat ulang halaman
            untuk melanjutkan.
          </p>

          <details
            style={{
              fontSize: 12,
              color: '#9ca3af',
              maxWidth: 500,
              marginBottom: 24,
              textAlign: 'left',
              background: '#f3f4f6',
              borderRadius: 12,
              padding: '12px 16px',
              wordBreak: 'break-word',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#6b7280' }}>
              Detail Error
            </summary>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
          </details>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px',
              fontSize: 14,
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#4f46e5',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#4338ca')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#4f46e5')}
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
