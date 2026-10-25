import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Lightbulb, ShieldAlert } from 'lucide-react';
import { api } from '../api/client.js';
import { Button, ConfirmDialog, ErrorState, Loading, Modal } from '../components/ui.jsx';
import { AssetImage, CATEGORY_LABELS } from '../components/EvidenceViewer.jsx';
import Room from './Room.jsx';
export default function Theory() {
  const { id } = useParams(),
    base = `/mysteries/${id}`,
    navigate = useNavigate(),
    qc = useQueryClient(),
    [step, setStep] = useState(0),
    [suspectId, setSuspectId] = useState(''),
    [motiveOptionId, setMotive] = useState(''),
    [evidenceIds, setEvidence] = useState([]),
    [confirm, setConfirm] = useState(false),
    [wrong, setWrong] = useState(null);
  const mystery = useQuery({ queryKey: ['mystery', id], queryFn: () => api(base) }),
    suspects = useQuery({ queryKey: ['suspects', id], queryFn: () => api(`${base}/suspects`) }),
    evidence = useQuery({ queryKey: ['evidence', id], queryFn: () => api(`${base}/evidence`) }),
    progress = useQuery({ queryKey: ['progress', id], queryFn: () => api(`${base}/progress`) });
  const submit = useMutation({
    mutationFn: () =>
      api(`${base}/accusation`, {
        method: 'POST',
        body: { suspectId, motiveOptionId, evidenceIds },
      }),
    onSuccess: (data) => {
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ['progress', id] });
      qc.invalidateQueries({ queryKey: ['mysteries'] });
      if (data.resolved) navigate(`${base}/results`, { replace: true });
      else setWrong(data);
    },
    onError: () => setConfirm(false),
  });
  const close = () => navigate(base);
  if ([mystery, suspects, evidence, progress].some((q) => q.isPending)) return <Loading />;
  const error = [mystery, suspects, evidence, progress].find((q) => q.error)?.error;
  if (error) return <ErrorState error={error} />;
  if (progress.data.status === 'completed') return <Navigate to={`${base}/results`} replace />;
  const p = progress.data,
    selected = suspects.data.items.find((s) => s.id === suspectId),
    motive = mystery.data.motiveOptions.find((m) => m.id === motiveOptionId),
    ordered = [...evidence.data.items].sort(
      (a, b) =>
        Number(p.pins.some((p) => p.evidenceId === b.id)) -
        Number(p.pins.some((p) => p.evidenceId === a.id)),
    ),
    valid = [Boolean(suspectId), Boolean(motiveOptionId), evidenceIds.length > 0, true][step];
  return (
    <>
      <Room />
      <div className="theory-overlay">
        {confirm ? (
          <ConfirmDialog
            title="Submit this accusation?"
            confirm="Confirm accusation"
            onClose={() => setConfirm(false)}
            onConfirm={() => submit.mutate()}
            loading={submit.isPending}
          >
            This uses one of your {p.attemptsRemaining} remaining{' '}
            {p.attemptsRemaining === 1 ? 'attempts' : 'attempts'}. A correct suspect ends the case
            immediately. A second wrong accusation also ends the investigation.
          </ConfirmDialog>
        ) : wrong ? (
          <Modal title="There’s more to this story." onClose={close}>
            <div className="modal-body wrong-theory">
              <Lightbulb size={28} strokeWidth={1} />
              <p>{wrong.nudge}</p>
              <span>{wrong.attemptsRemaining} attempt remaining. The case is still open.</span>
              <Button onClick={close}>
                Back to the case <ArrowRight size={15} />
              </Button>
            </div>
          </Modal>
        ) : (
          <Modal title="Build your theory" onClose={close} wide>
            <div className="theory-body">
              <div className="theory-stepper">
                {['Suspect', 'Motive', 'Evidence', 'Review'].map((label, i) => (
                  <div key={label} className={step === i ? 'active' : step > i ? 'done' : ''}>
                    <span>{step > i ? <Check size={12} /> : i + 1}</span>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <p className="eyebrow">
                STEP {step + 1} OF 4 / {p.attemptsRemaining} ATTEMPTS REMAINING
              </p>
              <h2>
                {
                  [
                    'Who do you suspect?',
                    'What was their motive?',
                    'What proves your theory?',
                    'Does the evidence hold up?',
                  ][step]
                }
              </h2>
              <p className="theory-help">
                {
                  [
                    'Choose the person whose story doesn’t match the evidence.',
                    'Choose the explanation that best connects the suspect to the incident.',
                    'Select 1–5 items that support your accusation. Pinned evidence appears first.',
                    'Check your reasoning. Once the case ends, your accusation is final.',
                  ][step]
                }
              </p>
              {step === 0 && (
                <fieldset className="theory-suspects">
                  <legend className="sr-only">Choose a suspect</legend>
                  {suspects.data.items.map((s) => (
                    <label key={s.id} className={suspectId === s.id ? 'selected' : ''}>
                      <AssetImage id={s.portraitAssetId} alt={`Fictional portrait of ${s.name}`} />
                      <span>
                        <strong>{s.name}</strong>
                        <small>{s.occupation}</small>
                      </span>
                      <input
                        type="radio"
                        name="suspect"
                        value={s.id}
                        checked={suspectId === s.id}
                        onChange={() => setSuspectId(s.id)}
                        aria-label={s.name}
                      />
                    </label>
                  ))}
                </fieldset>
              )}
              {step === 1 && (
                <fieldset className="theory-motives">
                  <legend className="sr-only">Choose a motive</legend>
                  {mystery.data.motiveOptions.map((m, i) => (
                    <label key={m.id} className={motiveOptionId === m.id ? 'selected' : ''}>
                      <span>0{i + 1}</span>
                      <p>{m.text}</p>
                      <input
                        type="radio"
                        name="motive"
                        checked={motiveOptionId === m.id}
                        onChange={() => setMotive(m.id)}
                        aria-label={m.text}
                      />
                    </label>
                  ))}
                </fieldset>
              )}
              {step === 2 && (
                <fieldset className="theory-evidence">
                  <legend className="sr-only">Choose supporting evidence</legend>
                  {ordered.map((e) => (
                    <label key={e.id} className={evidenceIds.includes(e.id) ? 'selected' : ''}>
                      <input
                        type="checkbox"
                        checked={evidenceIds.includes(e.id)}
                        disabled={!evidenceIds.includes(e.id) && evidenceIds.length >= 5}
                        onChange={() =>
                          setEvidence(
                            evidenceIds.includes(e.id)
                              ? evidenceIds.filter((id) => id !== e.id)
                              : [...evidenceIds, e.id],
                          )
                        }
                        aria-label={e.title}
                      />
                      <span>
                        <small>
                          {CATEGORY_LABELS[e.category]}
                          {p.pins.some((pin) => pin.evidenceId === e.id) ? ' · PINNED' : ''}
                        </small>
                        <strong>{e.title}</strong>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {step === 3 && (
                <div className="theory-review">
                  <section>
                    <p className="eyebrow">THE SUSPECT</p>
                    <h3>{selected.name}</h3>
                  </section>
                  <section>
                    <p className="eyebrow">THE MOTIVE</p>
                    <p>{motive.text}</p>
                  </section>
                  <section>
                    <p className="eyebrow">THE SUPPORTING EVIDENCE</p>
                    <ul>
                      {evidenceIds.map((id) => (
                        <li key={id}>{evidence.data.items.find((e) => e.id === id).title}</li>
                      ))}
                    </ul>
                  </section>
                  <div className="theory-warning">
                    <ShieldAlert size={17} />
                    <p>
                      A correct suspect closes the case. Your motive and evidence determine the
                      strength of your score.
                    </p>
                  </div>
                </div>
              )}
              {submit.error && <ErrorState error={submit.error} />}
              <div className="theory-footer">
                {step > 0 ? (
                  <Button variant="secondary" onClick={() => setStep(step - 1)}>
                    <ArrowLeft size={14} />
                    Back
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={close}>
                    Keep investigating
                  </Button>
                )}
                <Button
                  disabled={!valid}
                  onClick={() => (step === 3 ? setConfirm(true) : setStep(step + 1))}
                >
                  {step === 3 ? 'Submit theory' : 'Continue'}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
