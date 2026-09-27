import { useState } from 'react';

const base =
  'w-full rounded-2xl border bg-white/70 px-4 text-base text-ink outline-none transition-colors duration-200 placeholder:text-mute/60 focus:border-nura focus:ring-4 focus:ring-nura/20';
const controlHeight = 'h-12 sm:h-14';

export default function Field({ label, hint, error, type = 'text', as = 'input', options, children, ...props }) {
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  const id = props.id || props.name;
  const invalid = error ? 'border-alert' : 'border-line';

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        {as === 'textarea' ? (
          <textarea
            id={id}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={hint ? `${id}-hint` : undefined}
            className={`${base} ${invalid} min-h-28 resize-none py-3`}
            {...props}
          />
        ) : as === 'select' ? (
          <select
            id={id}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={hint ? `${id}-hint` : undefined}
            className={`${base} ${controlHeight} ${invalid} appearance-none bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22%23575D75%22><path%20d=%22M5.5%207.5l4.5%205%204.5-5%22%20stroke=%22%23575D75%22%20stroke-width=%221.5%22%20fill=%22none%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/></svg>')] bg-[right_1rem_center] bg-no-repeat pr-10`}
            {...props}
          >
            {children}
          </select>
        ) : (
          <input
            id={id}
            type={isPassword && shown ? 'text' : type}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={hint ? `${id}-hint` : undefined}
            className={`${base} ${controlHeight} ${isPassword ? 'pr-24' : ''} ${invalid}`}
            {...props}
          />
        )}
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
