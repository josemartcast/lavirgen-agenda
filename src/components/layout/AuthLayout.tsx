import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-arena flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}
