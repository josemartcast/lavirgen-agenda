import { Outlet, NavLink } from 'react-router-dom';
import { CalendarDays, Users, Scissors, Settings } from 'lucide-react';
import { OfflineBanner } from '../ui/OfflineBanner';
import { ToastHost } from '../ui/ToastHost';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/agenda', icon: CalendarDays, label: 'Hoy' },
  { to: '/clientes', icon: Users, label: 'Clientas' },
  { to: '/servicios', icon: Scissors, label: 'Servicios' },
  { to: '/configuracion', icon: Settings, label: 'Config' },
];

export function AppLayout() {
  const { isOwner } = useAuth();

  const filteredNav = navItems.filter((item) => {
    if (item.to === '/servicios' && !isOwner) return false;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-arena">
      <OfflineBanner />
      <ToastHost />
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-subtle z-30 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16">
          {filteredNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors
                ${isActive ? 'text-terracota' : 'text-gris'}`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
