import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Fingerprint,
  LockKeyhole,
  MessageSquare,
  ScanEye,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { PublicHeader } from '../components/Layout.jsx';
import { Brand } from '../components/ui.jsx';
const cases = [
  {
    n: '001',
    type: 'THEFT',
    title: 'The missing trophy',
    text: 'One locked cabinet. Three alibis. A school tradition that someone wanted to erase.',
    difficulty: 'Easy',
    style: 'trophy',
    icon: Fingerprint,
  },
  {
    n: '002',
    type: 'DISAPPEARANCE',
    title: 'The last exhibition',
    text: 'The gallery doors open. The artist is gone. Her final painting holds a different story.',
    difficulty: 'Medium',
    style: 'gallery',
    icon: ScanEye,
  },
  {
    n: '003',
    type: 'CORPORATE ESPIONAGE',
    title: 'A breach of trust',
    text: 'A prototype leaks hours before launch. Everyone on the inside has something to hide.',
    difficulty: 'Hard',
    style: 'office',
    icon: LockKeyhole,
  },
];
function EvidenceArtwork() {
  return (
    <div
      className="hero-art"
      aria-label="Illustrated detective case file with chat evidence and a reconstructed gallery scene"
      role="img"
    >
      <div className="art-grid" />
      <div className="art-cross one">+</div>
      <div className="art-cross two">+</div>
      <div className="case-folder">
        <div className="folder-tab">CASE FILE / 002</div>
        <div className="folder-inside">
          <div className="folder-meta">
            EVIDENCE DIVISION <span>CONFIDENTIAL</span>
          </div>
          <div className="folder-line" />
          <h3>
            The last
            <br />
            exhibition.
          </h3>
          <p>
            GALLERY DISAPPEARANCE
            <br />
            OPEN INVESTIGATION
          </p>
          <Fingerprint size={72} strokeWidth={0.65} className="folder-print" />
        </div>
      </div>
      <div className="scene-card">
        <div className="gallery-scene">
          <div className="gallery-door" />
          <div className="gallery-picture">
            <div />
          </div>
          <div className="gallery-shadow" />
          <span>CAM 02 — EAST GALLERY</span>
          <small>21:42:08</small>
        </div>
        <div className="scene-caption">
          <span>EXHIBIT B-04</span>
          <span>AI RECONSTRUCTION</span>
        </div>
      </div>
      <div className="chat-clue">
        <div className="clue-head">
          <MessageSquare size={13} /> RECOVERED CONVERSATION <span>•••</span>
        </div>
        <p>You said you left before nine.</p>
        <div>Then why is your coat in the gallery?</div>
        <small>
          21:46 <Check size={11} />
        </small>
      </div>
      <div className="art-tag">
        <span />
        EVERY DETAIL IS A CLUE
      </div>
    </div>
  );
}
export default function Landing() {
  return (
    <div className="landing">
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> YOUR NEXT OBSESSION IS AN OPEN CASE
            </div>
            <h1>
              A story begins.
              <br />A detail slips.
              <br />
              <em>You find the truth.</em>
            </h1>
            <p>
              Turn any idea into a mystery worth solving. Follow the conversations, examine the
              evidence, and build a case that holds up.
            </p>
            <div className="hero-actions">
              <Link to="/mysteries/new" className="button primary">
                Start your investigation <ArrowRight size={17} />
              </Link>
              <a className="text-button" href="#case-previews">
                Explore the case files <ChevronRight size={16} />
              </a>
            </div>
            <div className="hero-assurance">
              <ShieldCheck size={15} /> Fictional worlds. Fair clues. No lucky guesses.
            </div>
          </div>
          <EvidenceArtwork />
        </section>
        <section className="trust-strip" aria-label="Game features">
          <span>
            <Search size={16} />
            Built for deduction
          </span>
          <span>
            <FileText size={16} />
            Six kinds of evidence
          </span>
          <span>
            <LockKeyhole size={16} />
            The answer stays sealed
          </span>
          <span>
            <Fingerprint size={16} />
            Every case, your own
          </span>
        </section>
        <section className="section how-section" id="how-it-works">
          <div className="section-intro">
            <div>
              <p className="eyebrow">FROM A WHAT-IF TO A WHODUNIT</p>
              <h2>
                Bring your curiosity.
                <br />
                We’ll bring the case.
              </h2>
            </div>
            <p>
              No instructions to memorise. Just a story, a room full of secrets, and the evidence to
              work it out.
            </p>
          </div>
          <div className="steps">
            {[
              {
                title: 'Set the scene',
                text: 'A missing painting. A suspicious promotion. Give us a premise and choose your challenge.',
              },
              {
                title: 'Follow the evidence',
                text: 'Read between the messages. Scrub the CCTV reconstruction. Pin the details that don’t add up.',
              },
              {
                title: 'Make your case',
                text: 'Name the suspect, explain the motive, and back it up. Then see how the whole story fits.',
              },
            ].map((s, i) => (
              <article key={s.title}>
                <span className="step-number">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section case-section" id="case-previews">
          <div className="section-intro">
            <div>
              <p className="eyebrow">A GLIMPSE INSIDE THE ROOM</p>
              <h2>Every case has a loose thread.</h2>
            </div>
            <Link className="text-button" to="/register">
              Find yours <ArrowRight size={16} />
            </Link>
          </div>
          <div className="case-previews">
            {cases.map((c) => (
              <article className="preview-card" key={c.n}>
                <div className={`preview-art ${c.style}`}>
                  <c.icon size={62} strokeWidth={0.65} />
                  <span>CASE / {c.n}</span>
                  <div className="preview-stamp">FICTIONAL CASE CONCEPT</div>
                </div>
                <div className="preview-copy">
                  <p className="eyebrow">{c.type}</p>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  <div>
                    <span className={`badge ${c.difficulty.toLowerCase()}`}>{c.difficulty}</span>
                    <span className="muted">
                      {c.n === '001' ? '3' : c.n === '002' ? '4' : '5'} suspects
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="fair-play section">
          <ShieldCheck size={30} strokeWidth={1.2} />
          <div>
            <h2>
              A mystery should challenge you.
              <br />
              The clues should play fair.
            </h2>
            <p>
              Each case starts with the truth. Evidence is built around it, checked for consistency,
              and tested by an independent AI solver before you enter the room.
            </p>
          </div>
          <Link className="button secondary" to="/register">
            Take the first case <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer>
        <Brand />
        <p>
          All cases, people, conversations and images are AI-generated fiction.
          <br />
          CCTV sequences are fictional reconstructions.
        </p>
        <span>STAY CURIOUS.</span>
      </footer>
    </div>
  );
}
