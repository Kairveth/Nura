import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  ['/dashboard', 'Inicio'],
  ['/feed', 'Descubrir'],
  ['/matches', 'Matches'],
  ['/profile/create', 'Perfil']
];

// Misma barra, en el mismo sitio, en toda la app: nada de menús que aparecen y desaparecen.
// El mismo lenguaje visual (subrayado en nura) que el selector de Crear cuenta/Entrar de AuthLayout,
// para que "esto está activo" signifique siempre lo mismo.
export default function AppShell() {
  return (
    <div className="min-h-dvh bg-fog pb-20">
      <Outlet />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-fog/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-sm justify-around px-2 py-2">
          {TABS.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura ${
                  isActive ? 'text-ink' : 'text-mute hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  <span className={`h-0.5 w-6 rounded-full ${isActive ? 'bg-nura' : 'bg-transparent'}`} aria-hidden="true" />
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
