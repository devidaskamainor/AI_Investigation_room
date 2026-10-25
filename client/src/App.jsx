import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth.jsx';
import { PrivateLayout } from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateMystery from './pages/CreateMystery.jsx';
import Generating from './pages/Generating.jsx';
import Room from './pages/Room.jsx';
import Theory from './pages/Theory.jsx';
import Results from './pages/Results.jsx';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            {['register', 'login', 'forgot-password', 'reset-password'].map((mode) => (
              <Route key={mode} path={`/${mode}`} element={<Auth key={mode} mode={mode} />} />
            ))}
            <Route element={<PrivateLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/mysteries/new" element={<CreateMystery />} />
              <Route path="/mysteries/:id/generating" element={<Generating />} />
              <Route path="/mysteries/:id" element={<Room />} />
              <Route path="/mysteries/:id/theory" element={<Theory />} />
              <Route path="/mysteries/:id/results" element={<Results />} />
            </Route>
            <Route
              path="*"
              element={
                <main className="not-found">
                  <p className="eyebrow">FILE NOT FOUND / 404</p>
                  <h1>This trail goes cold.</h1>
                  <p>The page you’re looking for isn’t here.</p>
                  <Link to="/dashboard" className="button primary">
                    Back to case files
                  </Link>
                </main>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
