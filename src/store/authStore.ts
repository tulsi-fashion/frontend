import { create } from 'zustand';
interface AuthStore {
  token: string | null;
  user: { name: string; email: string; shopName: string } | null;
  setAuth: (token: string, user: { name: string; email: string; shopName: string }) => void;
  logout: () => void;
}
export const useAuthStore = create<AuthStore>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null,
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('tf_token', token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('tf_token');
    set({ token: null, user: null });
  },
}));
