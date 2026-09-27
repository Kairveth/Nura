import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import Field from '../components/Field';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const passOk = password.length >= 8 && password.length <= 72;
  const matchOk = confirm.length > 0 && confirm === password;

  if (!token) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-4xl font-normal tracking-[-0.04em] [font-stretch:88%] sm:text-[2.75rem] sm:leading-[1.05]">
          Enlace no válido
        </h1>
        <p className="text-mute">Este enlace de restablecimiento no es correcto o ya lo usaste. Pide uno nuevo.</p>
        <Link to="/forgot-password" className="inline-block font-semibold text-nura underline underline-offset-4 hover:text-nura-deep">
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-4xl font-normal tracking-[-0.04em] [font-stretch:88%] sm:text-[2.75rem] sm:leading-[1.05]">
          Contraseña actualizada
        </h1>
        <p className="text-mute">Ya puedes entrar con tu contraseña nueva. Cerramos el resto de sesiones abiertas.</p>
        <Link
          to="/login"
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-nura text-base font-semibold text-white transition-colors duration-200 hover:bg-nura-deep sm:h-14"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await client.post('/api/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(
        err.response?.status === 400
          ? 'El enlace caducó o ya se usó. Pide uno nuevo.'
          : 'No pudimos cambiar tu contraseña. Inténtalo de nuevo en un momento.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-normal tracking-[-0.04em] [font-stretch:88%] sm:text-[2.75rem] sm:leading-[1.05]">
          Elige una contraseña nueva
        </h1>
        <p className="mt-2 text-mute">Mínimo 8 caracteres.</p>
      </div>

      <Field
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Field
        label="Repite la contraseña"
        name="confirm"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        hint={confirm && !matchOk ? 'No coincide con la contraseña de arriba.' : undefined}
        error={confirm && !matchOk ? 'no coincide' : undefined}
        required
      />

      <div role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm font-semibold text-alert">
        {error}
      </div>

      <button
        type="submit"
        disabled={loading || !passOk || !matchOk}
        className="h-12 w-full rounded-2xl bg-nura text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura sm:h-14"
      >
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
