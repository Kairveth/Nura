import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  // Un registro recién hecho aterriza en /profile/create; el resto (login, sesión restaurada) va a
  // /dashboard. Es la ÚNICA fuente de verdad para ese destino: nadie más llama a navigate() tras
  // iniciar sesión, así no compite con la redirección reactiva de App.jsx (ver su comentario).
  justSignedUp: false,

  setAuth: (user, token, { justSignedUp = false } = {}) => set({ user, token, isAuthenticated: true, justSignedUp }),
  clearJustSignedUp: () => set({ justSignedUp: false }),
  logout: () => set({ user: null, token: null, isAuthenticated: false, justSignedUp: false })
}));
