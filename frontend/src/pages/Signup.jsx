import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import client from '../api/client';
import Field from '../components/Field';
import { useAuthStore } from '../store/authStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);
  const { setProgress } = useOutletContext();
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const emailOk = EMAIL_RE.test(email);
  const passOk = password.length >= 8;
  useEffect(() => setProgress((emailOk ? 0.4 : 0) + (passOk ? 0.6 : 0)), [emailOk, passOk, setProgress]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setExists(false);
    setLoading(true);
    try {
      const res = await client.post('/api/auth/signup', { email, password });
      setAuth(res.data.user, res.data.token);
      navigate('/profile/create');
    } catch (err) {
      if (err.response?.status === 409) {
        setExists(true);
        setError('Ese email ya tiene una cuenta.');
      } else if (err.response?.status === 400) {
        setError('Revisa el email y que la contraseña tenga entre 8 y 72 caracteres.');
      } else if (err.response?.status === 429) {
        setError('Demasiados intentos. Espera unos minutos y vuelve a probar.');
      } else {
        setError('No pudimos crear tu cuenta. Inténtalo de nuevo en un momento.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} noValidate className="space-y-4">
      <div>
        <h1 className="font-display text-4xl font-normal tracking-[-0.04em] [font-stretch:88%] sm:text-[2.75rem] sm:leading-[1.05]">Crea tu cuenta</h1>
        <p className="mt-2 text-mute">Solo email y contraseña. El perfil lo haces después, a tu ritmo.</p>
      </div>

      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={passOk ? 'Contraseña válida: 8 o más caracteres.' : 'Mínimo 8 caracteres.'}
        required
      />

      <div role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm font-semibold text-alert">
        {error}{' '}
        {exists && (
          <Link to="/login" className="underline underline-offset-4">
            Entra con ella
          </Link>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !emailOk || !passOk}
        className="h-12 w-full rounded-2xl bg-nura sm:h-14 text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura"
      >
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="text-sm text-mute">
        Guardamos tu email solo para que puedas entrar. Puedes borrar tu cuenta cuando quieras.
      </p>
    </form>
  );
}
