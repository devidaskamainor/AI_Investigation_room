import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, Check, ChevronRight, FileSearch, ShieldCheck } from 'lucide-react';
import { api } from '../api/client.js';
import { BackLink, Badge, ErrorState, Loading } from '../components/ui.jsx';
import { AssetImage, storyTime } from '../components/EvidenceViewer.jsx';
export default function Results() {
  const { id } = useParams(),
    base = `/mysteries/${id}`,
    query = useQuery({ queryKey: ['results', id], queryFn: () => api(`${base}/results`) });
  if (query.isPending) return <Loading label="Unsealing the solution…" />;
  if (query.error)
    return (
      <div className="page">
        <BackLink to="/dashboard" />
        <ErrorState error={query.error} />
        <Link to={base}>Return to investigation</Link>
      </div>
    );
  const r = query.data;
  return (
    <div className="page results-page">
      <BackLink to="/dashboard" />
      <header className="results-heading">
        <div>
          <p className="eyebrow">CASE CLOSED / THE FULL PICTURE</p>
          <h1>{r.title}</h1>
          <p>
            {r.result.correct
              ? 'You found the culprit. Here’s how the details connect.'
              : 'Every case leaves a lesson. Here’s what the evidence was telling you.'}
          </p>
        </div>
        <Badge tone="completed">
          <Check size={10} />
          Investigation completed
        </Badge>
      </header>
      <section className="result-score">
        <div className="score-medallion">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="53" />
            <circle
              cx="60"
              cy="60"
              r="53"
              style={{ strokeDasharray: `${r.result.score * 3.33} 333` }}
            />
          </svg>
          <strong>{r.result.score}</strong>
          <small>OUT OF 100</small>
        </div>
        <div className="rank-copy">
          <p className="eyebrow">YOUR DETECTIVE RANK</p>
          <h2>{r.result.rank}</h2>
          <p>
            {r.result.attemptsUsed} {r.result.attemptsUsed === 1 ? 'accusation' : 'accusations'} ·{' '}
            {r.result.hintsUsed} {r.result.hintsUsed === 1 ? 'hint' : 'hints'} used
          </p>
        </div>
        <div className="score-breakdown">
          {[
            ['culprit', 'Culprit'],
            ['motive', 'Motive'],
            ['evidence', 'Evidence'],
            ['efficiency', 'Efficiency'],
          ].map(([key, label]) => (
            <div key={key}>
              <span>{label}</span>
              <strong>+{r.result.breakdown[key]}</strong>
            </div>
          ))}
        </div>
      </section>
      <div className="results-columns">
        <section className="solution-card">
          <p className="eyebrow">BEHIND THE ALIBI</p>
          <div className="culprit-reveal">
            <AssetImage
              id={r.culprit.portraitAssetId}
              alt={`Fictional portrait of ${r.culprit.name}`}
            />
            <div>
              <span>THE CULPRIT</span>
              <h2>{r.culprit.name}</h2>
              <p>{r.culprit.occupation}</p>
            </div>
            <FileSearch size={32} strokeWidth={0.8} />
          </div>
          {[
            ['The motive', r.motive],
            ['The method', r.method],
            ['The opportunity', r.opportunity],
          ].map(([title, text]) => (
            <article className="solution-detail" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
          <div className="your-theory">
            <p className="eyebrow">YOUR FINAL THEORY</p>
            <p>
              You accused <strong>{r.submittedTheory.suspectName}</strong>.
            </p>
            <p>
              Motive: {r.submittedTheory.motiveOptionText}{' '}
              <span className={r.submittedTheory.motiveCorrect ? 'correct-text' : 'muted'}>
                ({r.submittedTheory.motiveCorrect ? 'correct' : 'not the canonical motive'})
              </span>
            </p>
          </div>
        </section>
        <section className="solution-card reveal-timeline">
          <p className="eyebrow">WHAT REALLY HAPPENED</p>
          <h2>The timeline, reconstructed.</h2>
          <ol className="evidence-timeline">
            {r.timeline.map((e, i) => (
              <li key={i}>
                <time>{storyTime(e.time)} UTC</time>
                <p>{e.event}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="reveal-explanation">
        <div className="reveal-section-title">
          <Award size={22} strokeWidth={1} />
          <div>
            <p className="eyebrow">THE THREAD THAT CONNECTS IT ALL</p>
            <h2>How the case fits together.</h2>
          </div>
        </div>
        <p>{r.explanation}</p>
        <div className="key-evidence-grid">
          {r.keyEvidence.map((e, i) => (
            <Link key={e.id} to={`${base}?evidence=${e.id}`}>
              <span className="eyebrow">KEY EVIDENCE / 0{i + 1}</span>
              <h3>{e.title}</h3>
              <p>{e.description}</p>
              <span>
                Revisit evidence <ChevronRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="red-herrings">
        <p className="eyebrow">THE DETAILS THAT MISLED</p>
        <h2>Every red herring has an explanation.</h2>
        <div>
          {r.redHerrings.map((h) => (
            <article key={h.evidenceId}>
              <h3>{h.title}</h3>
              <p>{h.explanation}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="result-footer">
        <p>
          <ShieldCheck size={14} />
          {r.fictionLabel}
        </p>
        <div className="button-row">
          <Link className="button secondary" to={base}>
            Reopen case file
          </Link>
          <Link className="button primary" to="/mysteries/new">
            Your next investigation <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
