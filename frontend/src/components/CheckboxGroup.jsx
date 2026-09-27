// Casillas de verdad (no chips-simulando-checkbox): nativas, con teclado y lector de pantalla
// gratis, sin gestionar aria-checked a mano. Se usa para "neurotipo", que ahora admite varias
// marcas a la vez (TDAH + TEA + "sin diagnóstico formal", etc.).
export default function CheckboxGroup({ label, options, value, onChange, hint, error }) {
  const toggle = (option) => {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-line bg-white/70 p-3 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-fog">
            <input
              type="checkbox"
              checked={value.includes(option)}
              onChange={() => toggle(option)}
              className="h-4 w-4 shrink-0 accent-nura"
            />
            {option}
          </label>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-sm text-mute">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
