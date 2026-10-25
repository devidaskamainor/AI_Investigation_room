import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Fingerprint, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client.js';
import { BackLink, Button, ErrorState, Loading } from '../components/ui.jsx';
const stages = [
  {
    title: 'The truth takes shape',
    at: 5,
    desc: 'Establishing what happened, and who was involved.',
  },
  {
    title: 'The suspects assemble',
    at: 20,
    desc: 'Building relationships, statements and alibis.',
  },
  {
    title: 'The evidence comes together',
    at: 30,
    desc: 'Writing the conversations and tracing the timeline.',
  },
  {
    title: 'The scene comes to life',
    at: 60,
    desc: 'Creating portraits, photographs and CCTV reconstructions.',
  },
  {
    title: 'Every detail is checked',
    at: 85,
    desc: 'Testing the evidence, fairness and independent solution.',
  },
  { title: 'Your case is ready', at: 100, desc: 'Sealing the answer. Opening the investigation.' },
];
export default function Generating() {
  const { id } = useParams(),
    navigate = useNavigate(),
    qc = useQueryClient();
  const mystery = useQuery({ queryKey: ['mystery', id], queryFn: () => api(`/mysteries/${id}`) });
  const job = useQuery({
    queryKey: ['job', mystery.data?.jobId],
    queryFn: () => api(`/generation-jobs/${mystery.data.jobId}`),
    enabled: Boolean(mystery.data?.jobId),
    refetchInterval: (q) => (['completed', 'failed'].includes(q.state.data?.status) ? false : 2000),
  });
  useEffect(() => {
    if (job.data?.status === 'completed') {
      qc.invalidateQueries({ queryKey: ['mysteries'] });
      navigate(`/mysteries/${id}`, { replace: true });
    }
  }, [job.data?.status, id, navigate, qc]);
  const retry = useMutation({
    mutationFn: () => api(`/generation-jobs/${job.data.id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job'] });
      qc.invalidateQueries({ queryKey: ['mystery', id] });
    },
  });
  if (mystery.isPending) return <Loading />;
  if (mystery.error || job.error)
    return (
      <ErrorState
        error={mystery.error || job.error}
        retry={() => {
          mystery.refetch();
          job.refetch();
        }}
      />
    );
  const progress = job.data?.progressPercentage || 0,
    failed = job.data?.status === 'failed';
  return (
    <div className="page generating-page">
      <BackLink to="/dashboard" />
      <div className="generation-center">
        <div className={`generation-emblem ${failed ? 'failed' : ''}`}>
          <Fingerprint size={65} strokeWidth={0.8} />
        </div>
        <p className="eyebrow">
          {failed ? 'THE CASE COULD NOT BE PREPARED' : 'SOMEWHERE, A STORY IS TAKING SHAPE'}
        </p>
        <h1>{failed ? 'A loose end needs another look.' : 'Your mystery is coming together.'}</h1>
        <p className="muted">
          {failed
            ? job.data.safeErrorMessage
            : 'The truth is being written. Soon, it’s yours to uncover.'}
        </p>
        {failed && (
          <Button
            onClick={() => retry.mutate()}
            loading={retry.isPending}
            disabled={job.data.attempts >= 3}
          >
            <RefreshCw size={16} />
            {job.data.attempts >= 3 ? 'Retry limit reached' : 'Try again'}
          </Button>
        )}
        {retry.error && <ErrorState error={retry.error} />}
        <div className="generation-progress">
          <div
            role="progressbar"
            aria-label="Generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
        <p className="stage-status" aria-live="polite">
          {job.data?.currentStage || 'Waiting for the worker'}
          {job.data?.status === 'repairing' && ' — refining a clue before publication'}
        </p>
        <ol className="generation-stages">
          {stages.map((s, i) => {
            const done = progress >= (stages[i + 1]?.at || 100);
            const current = !done && progress >= s.at;
            return (
              <li key={s.title} className={done ? 'done' : current ? 'current' : ''}>
                <span className="stage-icon">
                  {done ? (
                    <Check size={16} />
                  ) : current && !failed ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    String(i + 1).padStart(2, '0')
                  )}
                </span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="generation-footnote">
          {failed
            ? 'No partial case has been published.'
            : 'You can leave this page. Your case keeps generating in the background.'}
          <br />
          <Link to="/dashboard">Return to your case files</Link>
        </p>
      </div>
    </div>
  );
}
