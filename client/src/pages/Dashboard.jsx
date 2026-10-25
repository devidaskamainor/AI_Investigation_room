import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock3, FolderClosed, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Loading,
} from '../components/ui.jsx';
export default function Dashboard() {
  const { user } = useAuth(),
    queryClient = useQueryClient(),
    [tab, setTab] = useState(''),
    [page, setPage] = useState(1),
    [deleting, setDeleting] = useState(null);
  const query = useQuery({
    queryKey: ['mysteries', tab, page],
    queryFn: () => api(`/mysteries?page=${page}&limit=12${tab ? `&status=${tab}` : ''}`),
    refetchInterval: (q) =>
      q.state.data?.items.some((m) => ['generating', 'validating'].includes(m.status))
        ? 5000
        : false,
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/mysteries/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['mysteries'] });
    },
  });
  const demos = useQuery({ queryKey: ['demos'], queryFn: () => api('/demo-cases'), retry: false });
  const importDemo = useMutation({
    mutationFn: (slug) => api(`/demo-cases/${slug}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mysteries'] }),
  });
  const items = query.data?.items || [];
  return (
    <div className="page dashboard">
      <div className="page-topline">
        <span className="eyebrow">DETECTIVE WORKSPACE</span>
        <span className="muted">
          {new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>
      <header className="page-heading">
        <div>
          <h1>
            Your case files<span className="amber">.</span>
          </h1>
          <p>Welcome back, {user.name.split(' ')[0]}. There’s always another detail to uncover.</p>
        </div>
        <Link className="button primary" to="/mysteries/new">
          <Plus size={17} />
          New investigation
        </Link>
      </header>
      <div className="dashboard-note">
        <FolderClosed size={23} strokeWidth={1.2} />
        <div>
          <strong>A good theory starts with a small detail.</strong>
          <p>Pick up where you left off, or open a case that’s entirely your own.</p>
        </div>
        <span className="case-count">
          {query.data?.total || 0}
          <small>CASE FILES</small>
        </span>
      </div>
      <div className="tabs" role="tablist" aria-label="Case status">
        {[
          ['', 'All cases'],
          ['in_progress', 'In progress'],
          ['completed', 'Completed'],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => {
              setTab(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Your first case is an idea away."
          action={
            <Link to="/mysteries/new" className="button primary">
              Create a mystery <ArrowRight size={16} />
            </Link>
          }
        >
          A locked room, a missing person, a secret worth keeping.
          <br />
          What story would you like to investigate?
        </EmptyState>
      ) : (
        <div className="mystery-grid">
          {items.map((m, i) => (
            <article className="mystery-card" key={m.id}>
              <div className="mystery-card-top">
                <span className="eyebrow">
                  FILE / {String((page - 1) * 12 + i + 1).padStart(3, '0')}
                </span>
                <Badge tone={m.outcome ? 'completed' : m.status}>
                  {m.outcome ? 'Completed' : m.status}
                </Badge>
              </div>
              <h2>{m.title || 'An untitled mystery'}</h2>
              <p>
                {m.incident?.summary ||
                  'A new story is taking shape. Follow its progress as the evidence comes together.'}
              </p>
              <div className="card-meta">
                <Badge tone={m.difficulty}>{m.difficulty}</Badge>
                <span>{m.suspectCount} suspects</span>
                <span>
                  <Clock3 size={12} />
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>
              {['generating', 'validating'].includes(m.status) && (
                <div className="mini-progress">
                  <div style={{ width: `${m.progressPercentage || 0}%` }} />
                </div>
              )}
              <div className="card-actions">
                <Link
                  className="text-button"
                  to={
                    m.outcome
                      ? `/mysteries/${m.id}/results`
                      : m.status === 'ready'
                        ? `/mysteries/${m.id}`
                        : `/mysteries/${m.id}/generating`
                  }
                >
                  {m.outcome ? 'View results' : m.status === 'ready' ? 'Open case' : 'View status'}
                  <ArrowRight size={15} />
                </Link>
                <button
                  className="icon-button"
                  aria-label={`Delete ${m.title}`}
                  onClick={() => setDeleting(m)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {query.data?.total > 12 && (
        <div className="pagination">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {Math.ceil(query.data.total / 12)}
          </span>
          <Button
            variant="secondary"
            disabled={page * 12 >= query.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {demos.data && (
        <section className="demo-section">
          <p className="eyebrow">PRE-GENERATED DEMO CASES</p>
          <p className="muted">These cases were created in advance through the real pipeline.</p>
          {demos.data.items.length ? (
            <div className="button-row">
              {demos.data.items.map((d) => (
                <Button
                  key={d.slug}
                  variant="secondary"
                  onClick={() => importDemo.mutate(d.slug)}
                  loading={importDemo.isPending}
                >
                  {d.title}
                </Button>
              ))}
            </div>
          ) : (
            <p className="muted">
              No showcase cases have been generated yet. Run the fixture generator with your Gemini
              credentials to add them.
            </p>
          )}
          {importDemo.error && <ErrorState error={importDemo.error} />}
        </section>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this case?"
          confirm="Delete case"
          danger
          onClose={() => {
            setDeleting(null);
            remove.reset();
          }}
          onConfirm={() => remove.mutate(deleting.id)}
          loading={remove.isPending}
        >
          “{deleting.title}” and its notes, progress and evidence will be permanently removed.
          {remove.error && <ErrorState error={remove.error} />}
        </ConfirmDialog>
      )}
    </div>
  );
}
