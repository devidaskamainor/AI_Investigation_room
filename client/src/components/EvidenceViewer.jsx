import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Pause,
  Play,
  ShieldCheck,
  Video,
  ZoomIn,
} from 'lucide-react';
import { assetUrl } from '../api/client.js';
import { ErrorState } from './ui.jsx';
export const CATEGORY_LABELS = {
  message: 'Messages',
  image: 'Photographs',
  cctv: 'CCTV',
  document: 'Documents',
  witness_statement: 'Statements',
  timeline: 'Timeline',
  other: 'Other',
};
export const CATEGORY_ICONS = {
  message: MessageSquare,
  image: ImageIcon,
  cctv: Video,
  document: FileText,
  witness_statement: FileText,
  timeline: FileText,
  other: FileText,
};
export const storyTime = (value) =>
  new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  });
export function useMedia(query) {
  const [match, setMatch] = useState(() => Boolean(window.matchMedia?.(query).matches));
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatch(media.matches);
    const change = (e) => setMatch(e.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return match;
}
export function AssetImage({ id, alt, ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  return failed ? (
    <ErrorState
      error={{
        message: 'This evidence image could not be loaded. Reopen the item or try refreshing.',
      }}
    />
  ) : (
    <img {...props} src={assetUrl(id)} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  );
}
export function MessageThread({ content }) {
  let previousDate = '';
  return (
    <div className="message-view">
      <header>
        <span className="thread-avatar">
          <MessageSquare size={19} />
        </span>
        <div>
          <strong>{content.participants.join(', ')}</strong>
          <small>Recovered fictional conversation</small>
        </div>
      </header>
      <div className="message-body">
        {content.messages.map((m, i) => {
          const date = new Date(m.sentAt).toLocaleDateString('en-GB', { timeZone: 'UTC' }),
            separator = date !== previousDate;
          previousDate = date;
          return (
            <div key={i}>
              {separator && <div className="date-separator">{date}</div>}
              <div
                className={`chat-message ${m.senderName === content.participants[0] ? 'sent' : 'received'} ${m.deleted ? 'deleted' : ''}`}
              >
                <span>{m.senderName}</span>
                <p>{m.deleted ? 'This message was deleted' : m.text}</p>
                <small>{storyTime(m.sentAt).slice(0, 5)}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function ImageLightbox({ content }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="image-view">
      <div className="image-zoom-stage">
        <AssetImage
          id={content.assetId}
          alt={content.altText}
          style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
        />
      </div>
      <div className="zoom-controls">
        <ZoomIn size={15} />
        <label>
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <span>{zoom}×</span>
      </div>
      <p>{content.caption}</p>
    </div>
  );
}
export function CctvPlayer({ content }) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    reduced = useMedia('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    if (!playing || reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % content.frames.length), 2000);
    return () => clearInterval(timer);
  }, [playing, reduced, content.frames.length]);
  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);
  const frame = content.frames[index];
  return (
    <div className="cctv-view">
      <div className="reconstruction-banner">
        <ShieldCheck size={13} />
        AI reconstruction, not real footage
      </div>
      <div className="cctv-screen">
        <AssetImage id={frame.assetId} alt={frame.caption} />
        <div className="cctv-lines" />
        <span className="camera-label">{content.cameraLabel}</span>
        <span className="camera-time">{storyTime(frame.timestamp)}</span>
        <span className="camera-rec">
          <i />
          REC
        </span>
        <span className="camera-location">{content.location}</span>
      </div>
      <div className="cctv-controls">
        <button
          className="icon-button"
          aria-label="Previous frame"
          onClick={() => {
            setPlaying(false);
            setIndex((i) => Math.max(0, i - 1));
          }}
          disabled={index === 0}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          aria-label={playing ? 'Pause CCTV' : 'Play CCTV'}
          onClick={() => {
            if (reduced) {
              setIndex((i) => (i + 1) % content.frames.length);
            } else setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          className="icon-button"
          aria-label="Next frame"
          onClick={() => {
            setPlaying(false);
            setIndex((i) => Math.min(content.frames.length - 1, i + 1));
          }}
          disabled={index === content.frames.length - 1}
        >
          <ChevronRight size={18} />
        </button>
        <input
          aria-label="CCTV frame"
          type="range"
          min={0}
          max={content.frames.length - 1}
          step={1}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
        />
        <span>
          {index + 1}/{content.frames.length}
        </span>
      </div>
      <p>{frame.caption}</p>
    </div>
  );
}
export function Timeline({ content, suspectId }) {
  const entries = content.entries.filter(
    (e) => !suspectId || e.relatedSuspectIds?.includes(suspectId),
  );
  return (
    <ol className="evidence-timeline">
      {entries.map((e, i) => (
        <li key={i}>
          <time>{storyTime(e.time)}</time>
          <p>{e.text}</p>
        </li>
      ))}
      {!entries.length && <li>No entries for this suspect.</li>}
    </ol>
  );
}
export default function EvidenceViewer({ evidence, suspectId }) {
  const c = evidence.content;
  return (
    <div className="evidence-detail">
      <div className="evidence-detail-meta">
        <span>{evidence.source.label}</span>
        <time>{storyTime(evidence.occurredAt)} UTC</time>
      </div>
      {evidence.category === 'message' ? (
        <MessageThread content={c} />
      ) : evidence.category === 'image' ? (
        <ImageLightbox content={c} />
      ) : evidence.category === 'cctv' ? (
        <CctvPlayer content={c} />
      ) : evidence.category === 'document' ? (
        <article className="document-view">
          <span className="eyebrow">{c.docType}</span>
          <h3>{evidence.title}</h3>
          <div className="document-byline">
            {c.author}
            <time>{new Date(c.createdAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</time>
          </div>
          <p>{c.body}</p>
        </article>
      ) : evidence.category === 'witness_statement' ? (
        <article className="statement-view">
          <p className="eyebrow">WITNESS TRANSCRIPT</p>
          <h3>{c.witnessName}</h3>
          <small>Recorded {storyTime(c.interviewedAt)} UTC</small>
          <blockquote>{c.statement}</blockquote>
        </article>
      ) : evidence.category === 'timeline' ? (
        <Timeline content={c} suspectId={suspectId} />
      ) : (
        <p className="plain-evidence">{c.body}</p>
      )}
      <p className="evidence-description">{evidence.description}</p>
      <div className="fiction-label">
        <ShieldCheck size={12} />
        {evidence.category === 'message'
          ? 'AI-generated fictional conversation'
          : 'AI-generated fiction'}
      </div>
    </div>
  );
}
