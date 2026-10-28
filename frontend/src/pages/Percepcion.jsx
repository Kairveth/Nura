import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';

// Los nombres de columna DEBEN coincidir con el backend (profiles.perc_*).
// Cada dimensión es un diferencial semántico 1–5: `left` ancla el valor 1, `right` el valor 5.
const DIMENSIONS = [
  {
    column: 'perc_ritmo',
    title: 'Tu ritmo mental',
    question: '¿Cómo se mueve tu cabeza?',
    left: 'Salto entre muchas ideas',
    right: 'Voy profundo en una'
  },
  {
    column: 'perc_estructura',
    title: 'Tu día a día',
    question: '¿Cómo llevas el día?',
    left: 'Fluyo sin plan',
    right: 'Necesito rutina y previsibilidad'
  },
  {
    column: 'perc_sensorial',
    title: 'Tu energía sensorial',
    question: '¿Qué ambiente necesitas?',
    left: 'Busco estímulo e intensidad',
    right: 'Necesito calma y poco ruido'
  },
  {
    column: 'perc_comunicacion',
    title: 'Cómo te comunicas',
    question: '¿Cómo dices las cosas?',
    left: 'Literal y directa',
    right: 'Entre líneas y tono'
  },
  {
    column: 'perc_emocional',
    title: 'Tu mundo emocional',
    question: '¿Cómo vives lo que sientes?',
    left: 'Lo siento todo muy intenso',
    right: 'Regulado y contenido'
  },
  {
    column: 'perc_social',
    title: 'Tu energía social',
    question: '¿Cómo te recargas?',
    left: 'Con gente',
    right: 'A solas'
  }
];

const VALUES = [1, 2, 3, 4, 5];

// Firma: la misma idea del aura de AuthLayout, en pequeño. Respira y se aquieta/define
// (menos difusa, más círculo) según avanza el cuestionario (p: 0 a 1). Una sola por pantalla.
function Aura({ p }) {
  const blur = 28 - 18 * p;
  const ease =
    'filter 900ms cubic-bezier(0.23, 1, 0.32, 1), transform 900ms cubic-bezier(0.23, 1, 0.32, 1), opacity 900ms ease';
  return (
    <div aria-hidden="true" className="mx-auto mb-6 grid h-24 w-24 place-items-center">
      <div className="animate-breathe relative aspect-square w-full" style={{ transform: `scale(${1 - 0.06 * p})` }}>
        <div className="absolute inset-0 rounded-full bg-nura opacity-80" style={{ filter: `blur(${blur}px)`, transition: ease }} />
        <div
          className="animate-drift absolute -left-[8%] top-[16%] h-[62%] w-[62%] rounded-full bg-dawn"
          style={{ filter: `blur(${blur}px)`, transition: ease, opacity: 0.95 - 0.3 * p }}
        />
        <div
          className="animate-drift absolute -right-[6%] bottom-[4%] h-[52%] w-[52%] rounded-full bg-sage"
          style={{ filter: `blur(${blur}px)`, transition: ease, animationDelay: '-6s', opacity: 0.9 - 0.25 * p }}
        />
        <div className="absolute inset-[8%] rounded-full border border-white/70" style={{ opacity: p, transition: 'opacity 900ms ease' }} />
      </div>
    </div>
  );
}

// Escala 1–5 como radiogroup accesible: 5 opciones tappables, teclado con flechas, foco visible.
function RadioScale({ value, onChange, left, right, labelId }) {
  const refs = useRef([]);

  const handleKeyDown = (e) => {
    const current = value ? VALUES.indexOf(value) : -1;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % VALUES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = current < 0 ? VALUES.length - 1 : (current + VALUES.length - 1) % VALUES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = VALUES.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(VALUES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="radiogroup" aria-labelledby={labelId} onKeyDown={handleKeyDown} className="flex items-center justify-between gap-2">
        {VALUES.map((val, i) => {
          const selected = value === val;
          const tabbable = selected || (!value && val === 1);
          return (
            <button
              key={val}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${val} de 5`}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => onChange(val)}
              className={`grid h-12 w-12 place-items-center rounded-full border text-base font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura ${
                selected ? 'border-nura bg-nura text-white' : 'border-line bg-white/70 text-mute hover:border-nura hover:text-ink'
              }`}
            >
              {val}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-start justify-between gap-4 text-sm text-mute">
        <span className="max-w-[9rem] text-left">{left}</span>
        <span className="max-w-[9rem] text-right">{right}</span>
      </div>
      <p className="mt-2 text-center text-sm text-mute">El 3 es un punto entre los dos.</p>
    </div>
  );
}

export default function Percepcion() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    perc_ritmo: null,
    perc_estructura: null,
    perc_sensorial: null,
    perc_comunicacion: null,
    perc_emocional: null,
    perc_social: null
  });

  // Precarga las respuestas existentes para poder editarlas. Sin perfil aún → se queda en blanco.
  useEffect(() => {
    let active = true;
    client
      .get('/api/profiles/me')
      .then((res) => {
        if (!active) return;
        setAnswers((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(prev)) {
            const v = res.data?.[key];
            next[key] = v === undefined ? null : v;
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const total = DIMENSIONS.length;
  const dimension = DIMENSIONS[step];
  const isLast = step === total - 1;
  const progress = (step + 1) / total;

  const setValue = (val) => setAnswers((prev) => ({ ...prev, [dimension.column]: val }));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    // Solo las dimensiones respondidas, como enteros (el backend rechaza strings con 400).
    const payload = {};
    for (const [key, val] of Object.entries(answers)) {
      if (val !== null) payload[key] = Number(val);
    }
    try {
      await client.put('/api/profiles', payload);
      navigate('/feed');
    } catch (err) {
      setError(
        err.response?.status === 400
          ? 'Revisa tus respuestas: cada una es un valor del 1 al 5.'
          : 'No pudimos guardar tus respuestas. Revisa tu conexión e inténtalo de nuevo.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="px-6 py-8 text-mute">Cargando…</p>;
  }

  const titleId = `dim-${dimension.column}-title`;
  const questionId = `dim-${dimension.column}-question`;

  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <Aura p={progress} />

      <p className="text-center text-sm font-semibold text-mute">
        Paso {step + 1} de {total}
      </p>

      <div className="animate-rise mt-4">
        <h1 id={titleId} className="text-center font-display text-3xl font-semibold tracking-tight [font-stretch:88%]">
          {dimension.title}
        </h1>
        <p id={questionId} className="mt-2 text-center text-mute">
          {dimension.question}
        </p>

        <div className="mt-8">
          <RadioScale
            value={answers[dimension.column]}
            onChange={setValue}
            left={dimension.left}
            right={dimension.right}
            labelId={questionId}
          />
        </div>
      </div>

      <div role="alert" aria-live="polite" className="mt-6 min-h-[1.5rem] text-center text-sm font-semibold text-alert">
        {error}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
          className="h-12 rounded-2xl px-5 text-base font-semibold text-mute underline underline-offset-4 transition-colors duration-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura sm:h-14"
        >
          Atrás
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-12 flex-1 rounded-2xl bg-nura text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura sm:h-14"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            className="h-12 flex-1 rounded-2xl bg-nura text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura sm:h-14"
          >
            Siguiente
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-mute">
        Puedes responder solo algunas y seguir. Afinas tu match a tu ritmo.
      </p>

      <div className="mt-4 text-center">
        <Link to="/feed" className="text-sm font-semibold text-mute underline underline-offset-4 hover:text-ink">
          Dejarlo para luego
        </Link>
      </div>
    </div>
  );
}
