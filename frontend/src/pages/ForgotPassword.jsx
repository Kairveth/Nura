import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Field from '../components/Field';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const emailOk = EMAIL_RE.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // El backend responde el MISMO mensaje exista o no la cuenta: no hay nada que distinguir aquí.
      await client.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(
        err.response?.status === 429
          ? 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
          : 'No pudimos procesar la solicitud. Inténtalo de nuevo en un momento.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-4xl font-normal tracking-[-0.04em] [font-stretch:88%] sm:text-[2.75rem] sm:leading-[1.05]">
            Revisa tu correo
          </h1>
          <p className="mt-2 text-mute">
            Si <strong className="text-ink">{email}</strong> tiene una cuenta, te enviamos un enlace para restablecer la
            contraseña. Caduca en 30 minutos.
          </p>
        </div>
        <Link
          to="/login"
          className="inline-block font-semibold text-nura underline underline-offset-4 hover:text-nura-deep"
        >
          Volver a entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-normal tracking-[-0.04em] [font-stretch:88%] sm:text-[2.75rem] sm:leading-[1.05]">
          Restablece tu contraseña
        </h1>
        <p className="mt-2 text-mute">Escribe tu email y te mandamos un enlace para volver a entrar.</p>
      </div>

      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <div role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm font-semibold text-alert">
        {error}
      </div>

      <button
        type="submit"
        disabled={loading || !emailOk}
        className="h-12 w-full rounded-2xl bg-nura text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura sm:h-14"
      >
        {loading ? 'Enviando…' : 'Enviar enlace'}
      </button>

      <Link to="/login" className="inline-block text-sm font-semibold text-mute underline underline-offset-4 hover:text-ink">
        Volver a entrar
      </Link>
    </form>
  );
}
