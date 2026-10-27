import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import Field from '../components/Field';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';
const buttonBase = `h-12 w-full rounded-2xl text-base font-semibold transition-[background-color,transform,opacity] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:h-14 ${focusRing}`;
// Un solo botón relleno en la vista (Descargar). El resto, con borde: misma forma, menos peso.
const outlined = `${buttonBase} border-2 border-line bg-white/50 text-ink hover:border-mute focus-visible:outline-nura`;
const danger = `${buttonBase} border-2 border-alert/60 bg-white/50 text-alert hover:border-alert focus-visible:outline-alert`;

const DELETE_ERRORS = {
  400: 'Escribe tu contraseña para confirmar.',
  403: 'La contraseña no es correcta. Revísala e inténtalo de nuevo.',
  429: 'Has hecho demasiados intentos. Espera 15 minutos y vuelve a probar.'
};

// Ajustes / GDPR (US-012, US-013). Las tres acciones son definitivas o casi, así que cada una dice
// exactamente qué hace antes de hacerlo. Nada de window.confirm: la doble confirmación es la propia pantalla.
export default function Settings() {
  const logout = useAuthStore((state) => state.logout);
  const [exportState, setExportState] = useState({ status: 'idle', file: '' });
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleted, setDeleted] = useState(false);
  const deleteTrigger = useRef(null);
  const wasConfirming = useRef(false);

  // Al cancelar, el foco vuelve al botón que abrió la confirmación (no se pierde al inicio de la página)
  useEffect(() => {
    if (wasConfirming.current && !confirming) deleteTrigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const handleExport = async () => {
    setExportState({ status: 'busy', file: '' });
    try {
      const res = await client.get('/api/account/export');
      const file = `nura-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file;
      link.click();
      URL.revokeObjectURL(url);
      setExportState({ status: 'done', file });
    } catch {
      setExportState({ status: 'error', file: '' });
    }
  };

  const handleLogoutAll = async () => {
    setSessionsBusy(true);
    setSessionsError('');
    try {
      await client.post('/api/auth/logout-all');
      logout();
    } catch {
      setSessionsError('No se pudieron cerrar las sesiones. Comprueba tu conexión e inténtalo de nuevo.');
      setSessionsBusy(false);
    }
  };

  const cancelDelete = () => {
    setConfirming(false);
    setPassword('');
    setDeleteError('');
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!password) return setDeleteError(DELETE_ERRORS[400]);
    setDeleting(true);
    setDeleteError('');
    try {
      await client.post('/api/account/delete', { password });
      setDeleted(true);
    } catch (err) {
      setDeleteError(DELETE_ERRORS[err.response?.status] ?? 'No se pudo borrar la cuenta. Comprueba tu conexión e inténtalo de nuevo.');
      setDeleting(false);
    }
  };

  // La cuenta ya no existe: el token no vale para nada, solo queda salir. Se confirma antes de
  // expulsar para que quede claro que ha funcionado (no un cierre de sesión sin explicación).
  if (deleted) {
    return (
      <div className="mx-auto max-w-sm px-6 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight [font-stretch:88%]">Cuenta borrada</h1>
        <p className="mt-2 text-mute" role="status">
          Hemos borrado tu cuenta, tu perfil, tu foto, tus matches y tus conversaciones. No queda ningún dato tuyo en Nura.
        </p>
        <button type="button" onClick={logout} className={`${outlined} mt-8`}>
          Salir
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <Link to="/profile/create" className="text-sm font-semibold text-mute underline underline-offset-4 hover:text-ink">
        Volver a tu perfil
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight [font-stretch:88%]">Ajustes</h1>

      {/* Mientras se confirma el borrado, solo queda ese paso en pantalla: una decisión a la vez */}
      {!confirming && (
        <>
          <section aria-labelledby="export-title" className="mt-6">
            <h2 id="export-title" className="text-lg font-semibold">
              Descargar mis datos
            </h2>
            <p className="mt-1 text-sm text-mute">
              Un archivo JSON con tu cuenta, tu perfil, tus matches y lo que has enviado. Nada de otras personas.
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportState.status === 'busy'}
              className={`${buttonBase} mt-3 bg-nura text-white hover:bg-nura-deep focus-visible:outline-nura`}
            >
              {exportState.status === 'busy' ? 'Preparando archivo…' : 'Descargar mis datos'}
            </button>
            <p role="status" aria-live="polite" className={`text-sm font-semibold empty:mt-0 ${exportState.status === 'error' ? 'text-alert' : 'text-mute'} mt-2`}>
              {exportState.status === 'done' && `Descargado: ${exportState.file}`}
              {exportState.status === 'error' && 'No se pudo preparar el archivo. Comprueba tu conexión e inténtalo de nuevo.'}
            </p>
          </section>

          <section aria-labelledby="sessions-title" className="mt-8">
            <h2 id="sessions-title" className="text-lg font-semibold">
              Cerrar todas las sesiones
            </h2>
            <p className="mt-1 text-sm text-mute">Cierra tu sesión en todos tus dispositivos, también en este.</p>
            <button type="button" onClick={handleLogoutAll} disabled={sessionsBusy} className={`${outlined} mt-3`}>
              {sessionsBusy ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones'}
            </button>
            <p role="alert" aria-live="polite" className="mt-2 text-sm font-semibold text-alert empty:mt-0">
              {sessionsError}
            </p>
          </section>
        </>
      )}

      <section aria-labelledby="delete-title" className={confirming ? 'mt-6' : 'mt-8'}>
        <h2 id="delete-title" className="text-lg font-semibold">
          Borrar mi cuenta
        </h2>
        {!confirming ? (
          <>
            <p className="mt-1 text-sm text-mute">Borra tu cuenta y todos tus datos al momento. No se puede deshacer.</p>
            <button ref={deleteTrigger} type="button" onClick={() => setConfirming(true)} className={`${danger} mt-3`}>
              Borrar mi cuenta
            </button>
          </>
        ) : (
          <form
            onSubmit={handleDelete}
            onKeyDown={(e) => e.key === 'Escape' && !deleting && cancelDelete()}
            noValidate
            className="mt-2"
          >
            <p className="text-sm font-semibold text-ink">Al borrar tu cuenta:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              <li>Se borran tu perfil y tu foto.</li>
              <li>Se borran tus matches y las conversaciones completas, también para la otra persona.</li>
              <li>No podrás recuperar nada. Si quieres guardar tus datos, cancela y descárgalos antes.</li>
            </ul>
            <div className="mt-4">
              <Field
                label="Escribe tu contraseña para confirmar"
                name="delete-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={deleteError}
              />
            </div>
            <p role="alert" aria-live="polite" className="mt-2 text-sm font-semibold text-alert empty:mt-0">
              {deleteError}
            </p>
            <button type="submit" disabled={deleting} className={`${danger} mt-4`}>
              {deleting ? 'Borrando cuenta…' : 'Borrar mi cuenta para siempre'}
            </button>
            <button
              type="button"
              onClick={cancelDelete}
              disabled={deleting}
              className={`mt-3 h-11 w-full rounded-2xl text-sm font-semibold text-mute underline underline-offset-4 hover:text-ink ${focusRing} focus-visible:outline-nura`}
            >
              Cancelar
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
