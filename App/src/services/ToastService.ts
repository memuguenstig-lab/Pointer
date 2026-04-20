import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  text: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (text: string, type: ToastType) => void;
  removeToast: (id: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (text: string, type: ToastType) => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, text, type }]
    }));

    // Auto-remove non-error toasts after 3 seconds
    if (type !== 'error') {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id)
        }));
      }, 3000);
    }
  },
  removeToast: (id: number) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  }
}));

// Helper function to show toasts
export const showToast = (text: string, type: ToastType = 'info') => {
  useToastStore.getState().addToast(text, type);
}; 