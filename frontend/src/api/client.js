import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001'
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si el servidor invalida la sesión (caducada, restablecida o token inválido), se cierra en el cliente
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const { status, data } = error.response ?? {};
    const sessionDead = status === 401 || (status === 403 && data?.error === 'Invalid token');
    if (sessionDead && useAuthStore.getState().token) useAuthStore.getState().logout();
    return Promise.reject(error);
  }
);

export default client;
