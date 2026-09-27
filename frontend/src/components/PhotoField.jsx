import { useRef, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png'];

// Foto de perfil: valida tipo y peso en el cliente (respuesta inmediata) y deja la subida real
// al servidor, que es quien decide si el fichero es de verdad una imagen.
export default function PhotoField({ previewUrl, uploading, error, onSelect }) {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState('');

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setLocalError('La foto debe ser JPG o PNG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError('La foto pesa demasiado. Máximo 5 MB.');
      return;
    }
    setLocalError('');
    onSelect(file);
  };

  const shownError = localError || error;

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold">Foto</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={previewUrl ? 'Cambiar foto' : 'Añadir foto'}
          className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-white/70 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura ${
            shownError ? 'border-alert' : 'border-line hover:border-nura'
          }`}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl text-mute" aria-hidden="true">
              +
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-white/70 text-xs font-semibold text-ink">Subiendo…</span>
          )}
        </button>
        <div className="text-sm">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-nura underline underline-offset-4 hover:text-nura-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-nura"
          >
            {previewUrl ? 'Cambiar foto' : 'Elegir foto'}
          </button>
          <p className="mt-1 text-mute">JPG o PNG, máximo 5 MB. Solo esta foto, nada más.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="sr-only"
      />
      {shownError && (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
