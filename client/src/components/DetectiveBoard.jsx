import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pin, Plus, Trash2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { Badge, Button, ErrorState } from './ui.jsx';
function NoteEditor({ note, base, onSaved, completed }) {
  const [text, setText] = useState(note.text),
    [saved, setSaved] = useState(true);
  const mutation = useMutation({
    mutationFn: (body) => api(`${base}/progress/notes/${note.id}`, { method: 'PATCH', body }),
    onSuccess: (data) => {
      setSaved(true);
      onSaved(data);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`${base}/progress/notes/${note.id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
  });
  const mutate = mutation.mutate;
  useEffect(() => {
    if (completed || text === note.text || !text.trim()) return;
    setSaved(false);
    const timer = setTimeout(() => mutate({ text }), 800);
    return () => clearTimeout(timer);
  }, [text, note.text, completed, mutate]);
  return (
    <article className="note-card">
      <div>
        <span>PERSONAL NOTE</span>
        {!completed && (
          <button
            className="icon-button"
            aria-label="Delete note"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <textarea
        aria-label="Edit personal note"
        value={text}
        maxLength={10000}
        onChange={(e) => setText(e.target.value)}
        readOnly={completed}
      />
      <small aria-live="polite">
        {mutation.isPending ? (
          'Saving…'
        ) : saved ? (
          <>
            <Check size={10} />
            Saved
          </>
        ) : (
          'Unsaved changes'
        )}
      </small>
      {mutation.error && (
        <ErrorState error={mutation.error} retry={() => mutation.mutate({ text })} />
      )}
      {remove.error && <ErrorState error={remove.error} retry={() => remove.mutate()} />}
    </article>
  );
}
function PinCard({ pin, index, total, evidence, onOpen, onChange, onMove, onRemove, completed }) {
  const [label, setLabel] = useState(pin.label);
  return (
    <article className="pin-card">
      <div>
        <Pin size={12} />
        <span>{evidence?.category.replaceAll('_', ' ')}</span>
        {!completed && (
          <button
            className="icon-button"
            aria-label={`Unpin ${evidence?.title}`}
            onClick={onRemove}
          >
            <X size={13} />
          </button>
        )}
      </div>
      <button className="pin-title" onClick={onOpen}>
        {evidence?.title || 'Evidence'}
      </button>
      <input
        aria-label={`Label for ${evidence?.title}`}
        value={label}
        maxLength={120}
        placeholder="Add a connection or a question…"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (label !== pin.label) onChange(label);
        }}
        readOnly={completed}
      />
      {!completed && (
        <div className="pin-reorder">
          <button
            className="icon-button"
            aria-label={`Move ${evidence?.title} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={12} />
          </button>
          <button
            className="icon-button"
            aria-label={`Move ${evidence?.title} down`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={12} />
          </button>
        </div>
      )}
    </article>
  );
}
export default function DetectiveBoard({ base, progress, evidence, onSaved, onOpen }) {
  const [note, setNote] = useState(''),
    completed = progress.status === 'completed';
  const savePins = useMutation({
    mutationFn: (pins) => api(`${base}/progress/pins`, { method: 'PUT', body: { pins } }),
    onSuccess: onSaved,
  });
  const add = useMutation({
    mutationFn: () => api(`${base}/progress/notes`, { method: 'POST', body: { text: note } }),
    onSuccess: (data) => {
      setNote('');
      onSaved(data);
    },
  });
  function move(index, delta) {
    const pins = [...progress.pins];
    [pins[index], pins[index + delta]] = [pins[index + delta], pins[index]];
    savePins.mutate(pins);
  }
  return (
    <div className="detective-board">
      <div className="board-heading">
        <div>
          <h3>The connections are yours to make.</h3>
          <p>Pin what matters. Write down what doesn’t add up.</p>
        </div>
        <Badge>{progress.pins.length}/12 pins</Badge>
      </div>
      {progress.pins.length ? (
        <div className="pin-grid">
          {progress.pins.map((pin, i) => (
            <PinCard
              key={pin.evidenceId}
              pin={pin}
              index={i}
              total={progress.pins.length}
              evidence={evidence.find((e) => e.id === pin.evidenceId)}
              completed={completed}
              onOpen={() => onOpen(pin.evidenceId)}
              onRemove={() =>
                savePins.mutate(progress.pins.filter((p) => p.evidenceId !== pin.evidenceId))
              }
              onChange={(label) =>
                savePins.mutate(
                  progress.pins.map((p) => (p.evidenceId === pin.evidenceId ? { ...p, label } : p)),
                )
              }
              onMove={(delta) => move(i, delta)}
            />
          ))}
        </div>
      ) : (
        <div className="board-empty">
          <Pin size={23} strokeWidth={1} />
          <p>
            Open a piece of evidence and pin it here.
            <br />
            Start with the detail you can’t stop thinking about.
          </p>
        </div>
      )}
      {savePins.error && <ErrorState error={savePins.error} />}
      <div className="notes-heading">
        <h3>Detective’s notes</h3>
        <span>YOUR WORDS · NOT CASE EVIDENCE</span>
      </div>
      <div className="notes-list">
        {progress.notes.map((n) => (
          <NoteEditor key={n.id} note={n} base={base} onSaved={onSaved} completed={completed} />
        ))}
      </div>
      {!completed && (
        <div className="new-note">
          <textarea
            aria-label="New personal note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={10000}
            placeholder="A time that doesn’t fit. A statement to come back to…"
            rows={3}
          />
          <Button
            variant="secondary"
            disabled={!note.trim()}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            <Plus size={14} />
            Add note
          </Button>
          {add.error && <ErrorState error={add.error} />}
        </div>
      )}
    </div>
  );
}
