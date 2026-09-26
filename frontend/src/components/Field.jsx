import { useState } from 'react';

const base =
  'h-12 w-full rounded-2xl border sm:h-14 bg-white/70 px-4 text-base text-ink outline-none transition-colors duration-200 placeholder:text-mute/60 focus:border-nura focus:ring-4 focus:ring-nura/20';

export default function Field({ label, hint, error, type = 'text', ...props }) {
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  const id = props.id || props.name;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${base} ${isPassword ? 'pr-24' : ''} ${error ? 'border-alert' : 'border-line'}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-mute transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nura"
          >
            {shown ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-mute">
          {hint}
        </p>
      )}
    </div>
  );
}
