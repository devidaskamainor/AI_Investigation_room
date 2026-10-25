import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Lightbulb,
  MapPin,
  Pin,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { api } from '../api/client.js';
import {
  BackLink,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
} from '../components/ui.jsx';
import EvidenceViewer, {
  AssetImage,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  useMedia,
} from '../components/EvidenceViewer.jsx';
import DetectiveBoard from '../components/DetectiveBoard.jsx';
export default function Room() {
  const { id } = useParams(),
    base = `/mysteries/${id}`,
    qc = useQueryClient(),
    compact = useMedia('(max-width:1000px)'),
    mobile = useMedia('(max-width:680px)');
  const [selected, setSelected] = useState(null),
    [person, setPerson] = useState(null),
    [category, setCategory] = useState(''),
    [suspectFilter, setSuspectFilter] = useState(''),
    [rightTab, setRightTab] = useState('evidence'),
    [mobileTab, setMobileTab] = useState('evidence'),
    [hint, setHint] = useState(null),
    [pinError, setPinError] = useState('');
  const mystery = useQuery({ queryKey: ['mystery', id], queryFn: () => api(base) }),
    enabled = mystery.data?.status === 'ready';
  const suspects = useQuery({
      queryKey: ['suspects', id],
      queryFn: () => api(`${base}/suspects`),
      enabled,
    }),
    evidence = useQuery({
      queryKey: ['evidence', id],
      queryFn: () => api(`${base}/evidence`),
      enabled,
    }),
    progress = useQuery({
      queryKey: ['progress', id],
      queryFn: () => api(`${base}/progress`),
      enabled,
    }),
    detail = useQuery({
      queryKey: ['evidence-detail', id, selected],
      queryFn: () => api(`${base}/evidence/${selected}`),
      enabled: enabled && Boolean(selected),
    });
  const onSaved = (data) => qc.setQueryData(['progress', id], data),
    view = useMutation({
      mutationFn: (evidenceId) => api(`${base}/evidence/${evidenceId}/view`, { method: 'POST' }),
      onSuccess: onSaved,
    }),
    pins = useMutation({
      mutationFn: (items) => api(`${base}/progress/pins`, { method: 'PUT', body: { pins: items } }),
      onSuccess: onSaved,
    }),
    hints = useMutation({
      mutationFn: () => api(`${base}/hints`, { method: 'POST' }),
      onSuccess: (data) => {
        setHint(data.hint);
        qc.invalidateQueries({ queryKey: ['progress', id] });
      },
    });
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('evidence');
    setSelected(initial && /^[a-f0-9]{24}$/i.test(initial) ? initial : null);
  }, [id]);
  function open(evidenceId) {
    setSelected(evidenceId);
    setRightTab('evidence');
    view.mutate(evidenceId);
  }
  function togglePin() {
    const old = progress.data.pins,
      exists = old.some((p) => p.evidenceId === selected);
    if (!exists && old.length >= 12) {
      setPinError('Your board has 12 pins. Remove a pin to add another.');
      return;
    }
    setPinError('');
    pins.mutate(
      exists
        ? old.filter((p) => p.evidenceId !== selected)
        : [...old, { evidenceId: selected, label: '' }],
    );
  }
  if (mystery.isPending) return <Loading />;
  if (mystery.error) return <ErrorState error={mystery.error} />;
  if (!enabled) return <Navigate to={`${base}/generating`} replace />;
  if (suspects.isPending || evidence.isPending || progress.isPending)
    return <Loading label="Laying out the evidence…" />;
  if (suspects.error || evidence.error || progress.error)
    return (
      <ErrorState
        error={suspects.error || evidence.error || progress.error}
        retry={() => {
          suspects.refetch();
          evidence.refetch();
          progress.refetch();
        }}
      />
    );
  const m = mystery.data,
    p = progress.data,
    completed = p.status === 'completed',
    allEvidence = evidence.data.items,
    filtered = allEvidence.filter(
      (e) =>
        (!category || e.category === category) &&
        (!suspectFilter || e.relatedSuspectIds.includes(suspectFilter)),
    ),
    pinned = p.pins.some((item) => item.evidenceId === selected);
  const board = (
    <DetectiveBoard
      base={base}
      progress={p}
      evidence={allEvidence}
      onSaved={onSaved}
      onOpen={open}
    />
  );
  const viewer = (
    <>
      {detail.isPending ? (
        <Loading label="Opening evidence…" />
      ) : detail.error ? (
        <ErrorState error={detail.error} />
      ) : detail.data ? (
        <>
          <div className="viewer-heading">
            <div>
              <p className="eyebrow">{CATEGORY_LABELS[detail.data.category]} / CASE EVIDENCE</p>
              <h2>{detail.data.title}</h2>
            </div>
            {!completed && (
              <Button variant="secondary" onClick={togglePin} loading={pins.isPending}>
                <Pin size={14} />
                {pinned ? 'Unpin' : 'Pin'}
              </Button>
            )}
          </div>
          {(pinError || pins.error) && <ErrorState error={pins.error || { message: pinError }} />}
          <EvidenceViewer key={selected} evidence={detail.data} suspectId={suspectFilter} />
        </>
      ) : null}
    </>
  );
  return (
    <div className="room-page">
      <header className="room-header">
        <div>
          <BackLink to="/dashboard" />
          <div className="room-title">
            <h1>{m.title}</h1>
            <Badge tone={m.difficulty}>{m.difficulty}</Badge>
            {m.isDemo && <Badge>Pre-generated demo case</Badge>}
          </div>
          <p>
            <MapPin size={12} />
            {m.incident.location}
            <span>·</span>
            <Clock3 size={12} />
            {m.incident.whenLabel}
          </p>
        </div>
        <div className="room-actions">
          <Button
            variant="secondary"
            onClick={() => hints.mutate()}
            loading={hints.isPending}
            disabled={completed || p.hintsUsed >= 3}
          >
            <Lightbulb size={15} />
            Hint <span className="hint-count">{p.hintsUsed}/3</span>
          </Button>
          {completed ? (
            <Link className="button primary" to={`${base}/results`}>
              View results <ArrowRight size={15} />
            </Link>
          ) : (
            <Link className="button primary" to={`${base}/theory`}>
              Build a theory <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </header>
      {hints.error && <ErrorState error={hints.error} />}
      <div className={`case-briefing ${mobile && mobileTab !== 'briefing' ? 'mobile-hidden' : ''}`}>
        <div className="briefing-icon">
          <BookOpen size={22} strokeWidth={1.2} />
        </div>
        <div>
          <p className="eyebrow">THE BRIEFING</p>
          <p>{m.premise}</p>
        </div>
        <div className="briefing-stats">
          <span>
            <Users size={13} />
            {suspects.data.items.length} suspects
          </span>
          <span>
            <FileText size={13} />
            {allEvidence.length} evidence items
          </span>
        </div>
      </div>
      <div className="case-fiction">
        <ShieldCheck size={12} />
        This case and all evidence are AI-generated fiction. CCTV is a reconstruction.
      </div>
      {completed && (
        <div className="completed-banner">
          <Check size={16} />
          Investigation completed. Your saved theory and score are final.{' '}
          <Link to={`${base}/results`}>
            Read the reveal <ChevronRight size={13} />
          </Link>
        </div>
      )}
      <div className="room-workspace">
        <aside
          className={`room-suspects ${mobile && mobileTab !== 'suspects' ? 'mobile-hidden' : ''}`}
        >
          <div className="column-heading">
            <h2>Persons of interest</h2>
            <span>{suspects.data.items.length}</span>
          </div>
          <div className="suspect-directory">
            {suspects.data.items.map((s, i) => (
              <button key={s.id} className="suspect-item" onClick={() => setPerson(s)}>
                <div className="suspect-portrait">
                  <AssetImage id={s.portraitAssetId} alt={`Fictional portrait of ${s.name}`} />
                </div>
                <div>
                  <span className="eyebrow">SUSPECT / {String(i + 1).padStart(2, '0')}</span>
                  <h3>{s.name}</h3>
                  <p>{s.occupation}</p>
                </div>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="investigation-tip">
            <Search size={18} strokeWidth={1} />
            <p>
              Everyone has a story.
              <br />
              Let the evidence tell you which parts hold up.
            </p>
          </div>
        </aside>
        <section
          className={`evidence-column ${mobile && mobileTab !== 'evidence' ? 'mobile-hidden' : ''}`}
        >
          <div className="column-heading">
            <h2>The evidence</h2>
            <span>
              {p.viewedEvidenceIds.length}/{allEvidence.length} viewed
            </span>
          </div>
          <div className="evidence-filters">
            <select
              aria-label="Filter evidence category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All evidence</option>
              {Object.entries(CATEGORY_LABELS)
                .filter(([k]) => k !== 'other')
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </select>
            <select
              aria-label="Filter evidence by suspect"
              value={suspectFilter}
              onChange={(e) => setSuspectFilter(e.target.value)}
            >
              <option value="">All suspects</option>
              {suspects.data.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="evidence-list">
            {filtered.map((e, i) => {
              const Icon = CATEGORY_ICONS[e.category],
                viewed = p.viewedEvidenceIds.includes(e.id);
              return (
                <button
                  key={e.id}
                  className={`evidence-item ${selected === e.id ? 'selected' : ''}`}
                  onClick={() => open(e.id)}
                >
                  <span className={`evidence-type-icon ${e.category}`}>
                    <Icon size={19} strokeWidth={1.3} />
                  </span>
                  <div>
                    <div className="evidence-row-meta">
                      <span>{CATEGORY_LABELS[e.category]}</span>
                      {viewed ? (
                        <Check size={10} aria-label="Viewed" />
                      ) : (
                        <span className="unopened-dot" aria-label="Unopened" />
                      )}
                    </div>
                    <h3>{e.title}</h3>
                    <p>{e.source.label}</p>
                  </div>
                  <span className="evidence-number">{String(i + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
            {!filtered.length && (
              <EmptyState title="No matching evidence">Try a different filter.</EmptyState>
            )}
          </div>
        </section>
        {!compact && (
          <section className="viewer-column">
            <div className="viewer-tabs">
              <button
                className={rightTab === 'evidence' ? 'active' : ''}
                onClick={() => setRightTab('evidence')}
              >
                Evidence viewer
              </button>
              <button
                className={rightTab === 'board' ? 'active' : ''}
                onClick={() => setRightTab('board')}
              >
                Detective’s Board <span>{p.pins.length}</span>
              </button>
            </div>
            {rightTab === 'board' ? (
              board
            ) : selected ? (
              viewer
            ) : (
              <EmptyState title="Look a little closer.">
                <span>
                  Choose a piece of evidence to start.
                  <br />
                  The truth is in the details.
                </span>
              </EmptyState>
            )}
          </section>
        )}
        {compact && (!mobile || mobileTab === 'board') && (
          <section className="compact-board">
            <div className="column-heading">
              <h2>Detective’s Board</h2>
            </div>
            {board}
          </section>
        )}
      </div>
      {mobile && (
        <nav className="room-mobile-tabs" aria-label="Investigation sections">
          {[
            ['briefing', 'Briefing', BookOpen],
            ['suspects', 'Suspects', Users],
            ['evidence', 'Evidence', FileText],
            ['board', 'Board', Pin],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              aria-pressed={mobileTab === key}
              className={mobileTab === key ? 'active' : ''}
              onClick={() => setMobileTab(key)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {selected && compact && (
        <Modal title={detail.data?.title || 'Evidence'} onClose={() => setSelected(null)} wide>
          {viewer}
        </Modal>
      )}
      {person && (
        <Modal title={person.name} onClose={() => setPerson(null)}>
          <div className="suspect-profile">
            <AssetImage id={person.portraitAssetId} alt={`Fictional portrait of ${person.name}`} />
            <p className="eyebrow">
              {person.occupation} · {person.age}
            </p>
            <p>{person.background}</p>
            {[
              ['Connection to the incident', person.relationshipToIncident],
              ['Possible motive', person.publicMotive],
              ['Alibi', person.alibi],
              ['Initial statement', person.initialStatement],
            ].map(([title, text]) => (
              <section key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </section>
            ))}
            <Button
              variant="secondary"
              onClick={() => {
                setSuspectFilter(person.id);
                setPerson(null);
                setMobileTab('evidence');
              }}
            >
              Show related evidence <ArrowRight size={14} />
            </Button>
            <div className="fiction-label">AI-generated fictional person</div>
          </div>
        </Modal>
      )}
      {hint && (
        <Modal title={`Hint ${p.hintsUsed} of 3`} onClose={() => setHint(null)}>
          <div className="modal-body">
            <p>{hint}</p>
            <p className="hint-cost">Each hint removes 4 points from the efficiency bonus.</p>
            <Button variant="secondary" onClick={() => setHint(null)}>
              Back to the evidence
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
