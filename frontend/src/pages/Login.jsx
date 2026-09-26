import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import client from '../api/client';
import Field from '../components/Field';
import { useAuthStore } from '../store/authStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setProgress } = useOutletContext();
  const setAuth = useAuthStore((state) => state.setAuth);

  const emailOk = EMAIL_RE.test(email);
  const passOk = password.length > 0;
  useEffect(() => setProgress((emailOk ? 0.5 : 0) + (passOk ? 0.5 : 0)), [emailOk, passOk, setProgress]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/api/auth/login', { email, password });
      setAuth(res.data.user, res.data.token);
    } catch (err) {
      const status = err.response?.status;
      setError(
        status === 401
          ? 'Email o contraseña incorrectos. Revísalos e inténtalo de nuevo.'
          : status === 429
            ? 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
            : 'No pudimos conectar. Inténtalo de nuevo en un momento.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} noValidate className="space-y-4">
      <div>
        <h1 className="font-display text-4xl font-normal tracking-[-0.04em] [font-stretch:88%] sm:text-[2.75rem] sm:leading-[1.05]">Vuelve a entrar</h1>
        <p className="mt-2 text-mute">Por seguridad, tu sesión dura 1 hora.</p>
      </div>

      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

      <div role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm font-semibold text-alert">
        {error}
      </div>

      <button
        type="submit"
        disabled={loading || !emailOk || !passOk}
        className="h-12 w-full rounded-2xl bg-nura sm:h-14 text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura"
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
