import { create } from 'zustand'

export const useNotificationStore = create((set, get) => ({
  // State
  alert: null, 
  confirm: null, 
  promptData: null,

  // Actions
  showAlert: (message, type = 'info') => {
    const id = Date.now();
    set({ alert: { id, message, type } });
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
      const currentAlert = get().alert;
      if (currentAlert && currentAlert.id === id) {
        set({ alert: null });
      }
    }, 3000);
  },
  
  hideAlert: () => set({ alert: null }),

  showConfirm: (message, onConfirm, onCancel = () => {}) => {
    set({
      confirm: { 
        message, 
        onConfirm: () => {
          onConfirm();
          set({ confirm: null });
        }, 
        onCancel: () => {
          onCancel();
          set({ confirm: null });
        } 
      }
    });
  },
  
  hideConfirm: () => set({ confirm: null }),

  showPrompt: (message, defaultValue = '', onConfirm, onCancel = () => {}) => {
    set({
      promptData: {
        message,
        defaultValue,
        onConfirm: (val) => {
          onConfirm(val);
          set({ promptData: null });
        },
        onCancel: () => {
          onCancel();
          set({ promptData: null });
        }
      }
    });
  },
  hidePrompt: () => set({ promptData: null }),
}))

export default useNotificationStore
