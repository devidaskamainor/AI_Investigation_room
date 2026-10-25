import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Info, Sparkles } from 'lucide-react';
import { createMysterySchema } from '../../../shared/schemas/index.js';
import { MYSTERY_TYPES, PROFILES } from '../../../shared/constants/index.js';
import { api } from '../api/client.js';
import { BackLink, Button, ErrorState, Field } from '../components/ui.jsx';
const examples = [
  'A painter disappears during her own exhibition. The gallery was full, but nobody saw her leave.',
  'The school’s championship trophy vanishes from a locked cabinet on the morning of the final.',
  'Hours before a start-up launches its new product, a rival publishes the exact same design.',
];
export default function CreateMystery() {
  const navigate = useNavigate(),
    key = useRef(crypto.randomUUID()),
    [form, setForm] = useState({
      scenario: '',
      title: '',
      difficulty: 'medium',
      mysteryType: 'general',
      suspectCount: 4,
    }),
    [errors, setErrors] = useState({});
  const mutation = useMutation({
    mutationFn: (body) =>
      api('/mysteries', { method: 'POST', body, headers: { 'Idempotency-Key': key.current } }),
    onSuccess: (data) => navigate(`/mysteries/${data.mysteryId}/generating`),
  });
  function submit(e) {
    e.preventDefault();
    const parsed = createMysterySchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  }
  return (
    <div className="page create-page">
      <BackLink to="/dashboard" />
      <header className="page-heading">
        <div>
          <p className="eyebrow">OPEN A NEW INVESTIGATION</p>
          <h1>
            Every mystery starts
            <br />
            with a <span className="serif amber">what if.</span>
          </h1>
          <p>Set the scene. We’ll leave you the clues.</p>
        </div>
        <div className="heading-emblem">
          <Sparkles size={48} strokeWidth={0.8} />
        </div>
      </header>
      <form onSubmit={submit} className="create-form" noValidate>
        <section className="form-panel">
          <div className="panel-heading">
            <span className="step-pill">01</span>
            <div>
              <h2>The beginning of your story</h2>
              <p>A premise is enough. Keep the solution a surprise.</p>
            </div>
          </div>
          <Field label="What happened?" error={errors.scenario}>
            {(a) => (
              <textarea
                {...a}
                rows={5}
                maxLength={2000}
                value={form.scenario}
                onChange={(e) => setForm({ ...form, scenario: e.target.value })}
                placeholder="The doors were locked. The guests were still inside. But the painting was gone…"
              />
            )}
          </Field>
          <div className="character-count">
            <span>30–2,000 characters</span>
            <span>{form.scenario.length.toLocaleString()} / 2,000</span>
          </div>
          <div className="example-prompts">
            <span>Need a starting point?</span>
            {examples.map((example, i) => (
              <button
                key={example}
                type="button"
                onClick={() => setForm({ ...form, scenario: example })}
              >
                {['The missing artist', 'The trophy theft', 'The leaked prototype'][i]}{' '}
                <ArrowRight size={12} />
              </button>
            ))}
          </div>
          <Field label="Case title (optional)" hint="Leave it blank and we’ll name your case.">
            <input
              value={form.title}
              maxLength={120}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Give the case a name"
            />
          </Field>
        </section>
        <section className="form-panel">
          <div className="panel-heading">
            <span className="step-pill">02</span>
            <div>
              <h2>Choose your challenge</h2>
              <p>A sharper puzzle means subtler clues.</p>
            </div>
          </div>
          <fieldset className="difficulty-picker">
            <legend>Difficulty</legend>
            {Object.entries(PROFILES).map(([difficulty, p]) => (
              <label key={difficulty} className={form.difficulty === difficulty ? 'selected' : ''}>
                <input
                  type="radio"
                  name="difficulty"
                  value={difficulty}
                  checked={form.difficulty === difficulty}
                  onChange={() => setForm({ ...form, difficulty, suspectCount: p.suspects })}
                />
                <strong>{difficulty}</strong>
                <small>
                  {p.min}–{p.max} evidence items
                </small>
                <p>
                  {difficulty === 'easy'
                    ? 'Clear clues. A good place to begin.'
                    : difficulty === 'medium'
                      ? 'Connect the details. Question the alibis.'
                      : 'Subtle contradictions. Nothing is simple.'}
                </p>
              </label>
            ))}
          </fieldset>
          <div className="form-columns">
            <Field label="Mystery type" error={errors.mysteryType}>
              <select
                value={form.mysteryType}
                onChange={(e) => setForm({ ...form, mysteryType: e.target.value })}
              >
                {MYSTERY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of suspects" error={errors.suspectCount}>
              <select
                value={form.suspectCount}
                onChange={(e) => setForm({ ...form, suspectCount: Number(e.target.value) })}
              >
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} suspects
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
        <div className="privacy-tip">
          <Info size={18} />
          <p>
            Your scenario is sent to Google Gemini to create a fictional case. Keep personal
            information and real people out of your premise.
          </p>
        </div>
        {mutation.error && <ErrorState error={mutation.error} />}
        <div className="create-footer">
          <span>Up to 5 new cases per day · One generation at a time</span>
          <Button type="submit" loading={mutation.isPending}>
            Build my mystery <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </div>
  );
}
