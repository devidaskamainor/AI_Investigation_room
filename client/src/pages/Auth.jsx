import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} from '../../../shared/schemas/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../lib/auth.jsx';
import { Brand, Button, ErrorState, Field } from '../components/ui.jsx';
const modes = {
  register: {
    title: 'Every detective starts somewhere.',
    subtitle: 'Create an account. Open your first case.',
    button: 'Create account',
    schema: registerSchema,
  },
  login: {
    title: 'Welcome back, detective.',
    subtitle: 'Your unfinished cases are waiting.',
    button: 'Sign in',
    schema: loginSchema,
  },
  'forgot-password': {
    title: 'Let’s get you back in.',
    subtitle: 'Enter your email to request a password reset link.',
    button: 'Send reset link',
    schema: forgotSchema,
  },
  'reset-password': {
    title: 'A fresh set of credentials.',
    subtitle: 'Choose a new password for your account.',
    button: 'Update password',
    schema: resetSchema,
  },
};
export default function Auth({ mode }) {
  const config = modes[mode],
    [form, setForm] = useState({ name: '', email: '', password: '' }),
    [errors, setErrors] = useState({}),
    [message, setMessage] = useState(''),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    location = useLocation(),
    auth = useAuth();
  const mutation = useMutation({
    mutationFn: (body) => api(`/auth/${mode}`, { method: 'POST', body }),
    onSuccess: (data) => {
      if (data.user) {
        auth.setUser(data.user);
        navigate(location.state?.from || '/dashboard', { replace: true });
      } else setMessage(data.message);
    },
  });
  function submit(e) {
    e.preventDefault();
    const body =
      mode === 'register'
        ? form
        : mode === 'login'
          ? { email: form.email, password: form.password }
          : mode === 'forgot-password'
            ? { email: form.email }
            : { token: params.get('token') || '', password: form.password };
    const result = config.schema.safeParse(body);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    mutation.mutate(result.data);
  }
  const input = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
    required: true,
  });
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Brand />
      </div>
      <aside className="auth-aside">
        <div className="eyebrow">THE TRUTH IS IN THE DETAILS</div>
        <h2>
          Trust your instincts.
          <br />
          <em>Prove them with evidence.</em>
        </h2>
        <p>
          Step into a world of carefully constructed mysteries. Every clue matters. Every theory is
          yours.
        </p>
        <LockKeyhole size={120} strokeWidth={0.4} />
        <span>AI-GENERATED FICTION · HUMAN DEDUCTION</span>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <div className="eyebrow">
            MYSTERY ROOM / {mode === 'register' ? 'NEW DETECTIVE' : 'ACCESS'}
          </div>
          <h1>{config.title}</h1>
          <p className="muted">{config.subtitle}</p>
          {message ? (
            <div className="success-message" role="status">
              <p>{message}</p>
              <Link to="/login">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              {mode === 'register' && (
                <Field label="Your name" error={errors.name}>
                  {(a) => (
                    <input
                      {...a}
                      {...input('name')}
                      autoComplete="name"
                      placeholder="What should we call you?"
                    />
                  )}
                </Field>
              )}
              {mode !== 'reset-password' && (
                <Field label="Email address" error={errors.email}>
                  {(a) => (
                    <input
                      {...a}
                      {...input('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="detective@example.com"
                    />
                  )}
                </Field>
              )}
              {mode !== 'forgot-password' && (
                <Field
                  label="Password"
                  error={errors.password}
                  hint={mode === 'register' ? 'At least 8 characters.' : undefined}
                >
                  {(a) => (
                    <input
                      {...a}
                      {...input('password')}
                      type="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder="Enter your password"
                    />
                  )}
                </Field>
              )}
              {errors.token && (
                <p className="field-error" role="alert">
                  This reset link is invalid. Request a new link.
                </p>
              )}
              {mode === 'login' && (
                <Link className="forgot-link" to="/forgot-password">
                  Forgot your password?
                </Link>
              )}
              {mutation.error && <ErrorState error={mutation.error} />}
              <Button loading={mutation.isPending} type="submit" className="full">
                {config.button}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          <p className="auth-switch">
            {mode === 'register' ? (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            ) : mode === 'login' ? (
              <>
                New to the room? <Link to="/register">Create an account</Link>
              </>
            ) : (
              <Link to="/login">Return to sign in</Link>
            )}
          </p>
          <p className="auth-fine">
            All cases are fictional. Your account keeps your notes,
            <br />
            case history and progress in one place.
          </p>
        </div>
      </main>
    </div>
  );
}
