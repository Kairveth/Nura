import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const FACTS = [
  ['Una foto y 200 caracteres', 'Tu perfil es corto. Nadie te pide una foto perfecta.'],
  ['Chat de texto', 'Sin video. Escribes a tu ritmo.'],
  ['Tus datos son tuyos', 'Puedes exportarlos o borrarlos cuando quieras.']
];

// Aura: mancha difusa que se aquieta en un círculo definido según avanza el formulario (p: 0 a 1).
function Aura({ p }) {
  const blur = 64 - 40 * p;
  const ease = 'filter 900ms cubic-bezier(0.23, 1, 0.32, 1), transform 900ms cubic-bezier(0.23, 1, 0.32, 1), opacity 900ms ease';
  return (
    <div aria-hidden="true" className="absolute inset-0 grid place-items-center lg:-translate-y-[14%]">
      <div className="animate-breathe relative aspect-square w-[min(78%,30rem)]" style={{ transform: `scale(${1 - 0.08 * p})` }}>
        <div className="absolute inset-0 rounded-full bg-nura opacity-80" style={{ filter: `blur(${blur}px)`, transition: ease }} />
        <div className="animate-drift absolute -left-[8%] top-[18%] h-[62%] w-[62%] rounded-full bg-dawn" style={{ filter: `blur(${blur}px)`, transition: ease, opacity: 0.95 - 0.25 * p }} />
        <div className="animate-drift absolute -right-[6%] bottom-[4%] h-[52%] w-[52%] rounded-full bg-sage" style={{ filter: `blur(${blur}px)`, transition: ease, animationDelay: '-6s', opacity: 0.9 - 0.2 * p }} />
        <div className="absolute inset-[6%] rounded-full border border-white/70" style={{ opacity: p, transition: 'opacity 900ms ease' }} />
      </div>
    </div>
  );
}

export default function AuthLayout() {
  const [progress, setProgress] = useState(0);
  const isLogin = useLocation().pathname === '/login';

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
      <aside className="relative isolate h-[18dvh] min-h-28 max-h-48 overflow-hidden lg:h-auto lg:max-h-none lg:min-h-dvh">
        <Aura p={progress} />
        <Link
          to="/"
          className="absolute left-6 top-4 rounded-md font-display text-3xl font-bold lowercase tracking-tight text-ink [font-stretch:80%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink lg:left-12 lg:top-10"
        >
          nura
        </Link>

        <div className="absolute inset-x-6 bottom-12 hidden max-w-md lg:block xl:left-12">
          <p className="font-display text-5xl font-semibold leading-[1.02] tracking-tight [font-stretch:85%]">
            Menos perfiles.
            <br />
            Más intención.
          </p>
          <dl className="mt-8 space-y-4">
            {FACTS.map(([title, text]) => (
              <div key={title}>
                <dt className="text-sm font-semibold">{title}</dt>
                <dd className="text-sm text-mute">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      <main className="flex items-start justify-center px-6 pb-8 pt-6 lg:items-center lg:pt-0">
        <div className="animate-rise w-full max-w-sm">
          <nav aria-label="Acceso" className="mb-6 grid grid-cols-2 lg:mb-10 rounded-full border border-line bg-white/60 p-1 text-sm font-semibold">
            {[
              ['/', 'Crear cuenta', !isLogin],
              ['/login', 'Entrar', isLogin]
            ].map(([to, label, active]) => (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full py-2.5 text-center transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura ${
                  active ? 'bg-ink text-white' : 'text-mute hover:text-ink'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Outlet context={{ setProgress }} />
        </div>
      </main>
    </div>
  );
}
