import React from 'react';
import useNotificationStore from '../../store/useNotificationStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const GlobalNotification = () => {
  const { alert, confirm, promptData, hideAlert } = useNotificationStore();
  const [promptValue, setPromptValue] = React.useState("");

  React.useEffect(() => {
    if (promptData) {
      setPromptValue(promptData.defaultValue || "");
    }
  }, [promptData]);

  return (
    <>
      {/* Toast Alert */}
      {alert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
            alert.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {alert.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
            {alert.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
            {alert.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
            <span className="font-medium text-sm">{alert.message}</span>
            <button onClick={hideAlert} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={confirm.onCancel} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Konfirmasi</h3>
            <p className="text-gray-500 text-sm mb-6">{confirm.message}</p>
            
            <div className="flex gap-3 w-full">
              <button 
                onClick={confirm.onCancel}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirm.onConfirm}
                className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-95"
              >
                Yakin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={promptData.onCancel} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Input</h3>
            <p className="text-gray-500 text-sm mb-4">{promptData.message}</p>
            <input 
              type="text" 
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6 text-gray-900"
              value={promptValue} 
              onChange={e => setPromptValue(e.target.value)} 
              onKeyDown={e => {
                if (e.key === 'Enter') promptData.onConfirm(promptValue);
              }}
            />
            
            <div className="flex gap-3 w-full">
              <button 
                onClick={promptData.onCancel}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={() => promptData.onConfirm(promptValue)}
                className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalNotification;
