import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { FolderClosed, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Brand, Button, ErrorState, Loading } from './ui.jsx';
export function PublicHeader() {
  const { user } = useAuth();
  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Main navigation">
        <a className="quiet-link hide-small" href="/#how-it-works">
          How it works
        </a>
        {user ? (
          <Link className="button secondary small" to="/dashboard">
            My case files
          </Link>
        ) : (
          <>
            <Link className="quiet-link" to="/login">
              Sign in
            </Link>
            <Link className="button secondary small" to="/register">
              Enter the room <Plus size={14} />
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
export function PrivateLayout() {
  const auth = useAuth(),
    location = useLocation();
  if (auth.loading) return <Loading label="Checking your detective credentials…" />;
  if (auth.error) return <ErrorState error={auth.error} retry={() => window.location.reload()} />;
  if (!auth.user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <Brand />
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <NavLink to="/dashboard" className="sidebar-link">
          <FolderClosed size={18} /> Case files
        </NavLink>
        <NavLink to="/mysteries/new" className="sidebar-link">
          <Plus size={18} /> New investigation
        </NavLink>
        <div className="sidebar-bottom">
          <div className="fiction-note">
            <ShieldCheck size={17} />
            <span>
              Fictional cases.
              <br />
              Real deduction.
            </span>
          </div>
          <div className="user-block">
            <span className="avatar-initial">{auth.user.name[0].toUpperCase()}</span>
            <div>
              <strong>{auth.user.name}</strong>
              <small>Detective</small>
            </div>
            <Button
              variant="icon"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await auth.logout();
                } catch {
                  window.location.assign('/login');
                }
              }}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>
      <main id="main-content" className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
