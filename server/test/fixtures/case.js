// Explicitly authored test fixture. Never imported by the client or production generation path.
import { PROFILES } from '../../../shared/constants/index.js';
export function caseFixture({ difficulty = 'easy', suspectCount = 3 } = {}) {
  const profile = PROFILES[difficulty],
    time = '2026-01-10T21:42:00Z',
    ids = Array.from({ length: suspectCount }, (_, i) => `S${i + 1}`),
    names = ['Ada Vale', 'Ben Reed', 'Cleo Park', 'Daria Ives', 'Eli Stone', 'Farah Moss'];
  const facts = [
    { id: 'F1', text: 'Ada was being removed from the gallery partnership.', time },
    { id: 'F2', text: 'Ada had the only spare key to the sculpture cabinet.', time },
    { id: 'F3', text: 'Ada was inside the east gallery at 21:42.', time },
    { id: 'F4', text: 'The coat in the gallery is the same distinctive coat Ada wore.', time },
    ...ids.slice(1).map((s, i) => ({
      id: `F${i + 5}`,
      text: `${names[i + 1]} was continuously visible at the front desk with a signed receipt.`,
      time,
    })),
  ];
  const plan = {
    title: 'The Last Exhibition',
    premise:
      'A sculpture has vanished from a locked cabinet during a private gallery exhibition. Three conflicting accounts leave a trail of small details.',
    incident: {
      summary: 'A sculpture disappears during the gallery exhibition.',
      location: 'East Gallery',
      whenLabel: 'Saturday, 9:42 PM',
      startsAt: '2026-01-10T18:00:00Z',
      endsAt: '2026-01-10T23:00:00Z',
    },
    suspectIds: ids,
    culpritSuspectId: 'S1',
    correctMotiveOptionId: 'M1',
    motive: 'Retaliation over the partnership dismissal',
    method: 'Used the spare cabinet key and hid the sculpture in a coat bag',
    opportunity: 'Stayed inside after claiming to leave',
    motiveOptions: [
      { id: 'M1', text: 'Retaliation over losing a partnership' },
      { id: 'M2', text: 'An insurance payout' },
      { id: 'M3', text: 'A mistaken delivery' },
      { id: 'M4', text: 'A publicity stunt' },
    ],
    facts,
    canonicalTimeline: facts.map((f) => ({ time, event: f.text, factIds: [f.id] })),
    chain: { motiveFactId: 'F1', meansFactId: 'F2', opportunityFactId: 'F3' },
    hints: [
      'Compare the departure statements with the camera times.',
      'A distinctive item of clothing links two pieces of evidence.',
      'The spare cabinet key and a disputed departure time establish access and opportunity.',
    ],
    nudge: 'Recheck who could reach the east gallery after nine.',
    styleGuide:
      'Muted cinematic charcoal gallery with amber lights. Consistent fictional characters and coats. No embedded text.',
  };
  const suspects = {
    suspects: ids.map((id, i) => ({
      id,
      name: names[i],
      age: 28 + i,
      occupation: ['Gallery partner', 'Curator', 'Restorer', 'Designer', 'Accountant', 'Assistant'][
        i
      ],
      background: 'A regular member of the small gallery team.',
      relationshipToIncident: 'Worked at the exhibition.',
      publicMotive: 'Had a professional disagreement about the exhibition.',
      alibi: i === 0 ? 'I left the gallery before nine.' : 'I stayed at the front desk throughout.',
      initialStatement:
        i === 0 ? 'The cabinet was locked when I left.' : 'The desk receipt records where I was.',
      portraitPrompt: `Fictional portrait of ${names[i]}, age ${28 + i}, consistent dark gallery clothing and plain background. No text.`,
      claims: [
        {
          id: `C${i + 1}`,
          text: i === 0 ? 'I was home by nine.' : 'I was visible at the front desk.',
          contradictedByFactId: i === 0 ? 'F3' : null,
        },
      ],
      excludedByFactIds: i === 0 ? [] : [`F${i + 4}`],
    })),
  };
  const categories = [
    'message',
    'message',
    'image',
    'image',
    'cctv',
    'document',
    'witness_statement',
    'timeline',
  ];
  while (categories.length < profile.min)
    categories.push(categories.length % 2 ? 'document' : 'witness_statement');
  const allFacts = facts.map((f) => f.id),
    innocentFacts = allFacts.slice(4),
    herrings = ['E2', 'E4', 'E7'].slice(0, profile.herrings),
    items = categories.map((category, i) => {
      const id = `E${i + 1}`,
        establishes =
          i === 0
            ? ['F1', 'F2']
            : i === 2 || i === 4
              ? ['F3', 'F4']
              : innocentFacts.length
                ? innocentFacts
                : ['F1'];
      return {
        id,
        category,
        title:
          [
            'The partnership conversation',
            'Front desk messages',
            'A familiar coat',
            'The cabinet photograph',
            'East gallery camera',
            'Spare key register',
            'The receptionist’s statement',
            'Exhibition timeline',
          ][i] || `Archive record ${i + 1}`,
        description: 'A recovered record from the evening of the exhibition.',
        sourceLabel: 'Gallery archive',
        occurredAt: time,
        relatedSuspectIds: ids,
        establishes,
        roles: [
          ...(i === 2 || i === 4 ? ['contradicting'] : ['supporting']),
          ...(herrings.includes(id) ? ['red_herring'] : []),
        ],
        purpose: 'Establish the approved facts through visible details.',
      };
    });
  const evidence = {};
  for (const item of items) {
    const i = Number(item.id.slice(1)),
      assets = [];
    let content;
    switch (item.category) {
      case 'message':
        content = {
          participants: names.slice(0, 2),
          messages: Array.from({ length: 8 }, (_, j) => ({
            senderSuspectId: j % 2 ? 'S2' : 'S1',
            senderName: names[j % 2],
            text:
              j === 0
                ? 'The spare cabinet key is still with me.'
                : j === 1
                  ? 'The partnership letter says your role ends tonight.'
                  : `Please check the gallery arrangements, item ${j + 1}.`,
            sentAt: time,
            deleted: false,
          })),
        };
        break;
      case 'image': {
        const key = `A${item.id}`;
        content = {
          caption:
            i === 3
              ? 'The distinctive coat is visible inside the east gallery.'
              : 'A cabinet detail beside the reception desk.',
          altText: 'Fictional gallery photograph with a dark coat near a cabinet.',
          assetId: key,
        };
        assets.push({
          key,
          type: 'scene_image',
          prompt:
            'A fictional gallery scene with a distinctive dark coat and locked sculpture cabinet. No text.',
        });
        break;
      }
      case 'cctv':
        content = {
          cameraLabel: 'CAM 02',
          location: 'East Gallery',
          isReconstruction: true,
          frames: Array.from({ length: 3 }, (_, j) => {
            const key = `A${item.id}F${j + 1}`;
            assets.push({
              key,
              type: 'cctv_frame',
              prompt:
                'Fictional gallery CCTV still with a distinctive coat beside a cabinet and consistent lighting. No text.',
            });
            return {
              assetId: key,
              timestamp: time,
              caption: 'The distinctive coat remains in the east gallery.',
            };
          }),
        };
        break;
      case 'document':
        content = {
          docType: 'Key register',
          author: 'Gallery administrator',
          createdAt: time,
          body: 'Ada Vale retained the sole spare key. The partnership was scheduled to end tonight.',
        };
        break;
      case 'witness_statement':
        content = {
          witnessName: 'Morgan Lane',
          interviewedAt: time,
          statement:
            'The other staff members were together at the reception desk. Their signed receipts confirm their presence.',
          relatedSuspectIds: ids.slice(1),
        };
        break;
      case 'timeline':
        content = {
          entries: [
            {
              time,
              text: 'The reception desk receipts were signed while the east gallery camera recorded a distinctive coat.',
              relatedSuspectIds: ids,
            },
          ],
        };
        break;
    }
    evidence[item.id] = { id: item.id, content, assets };
  }
  const evidencePlan = {
    items,
    keyEvidenceIds: ['E1', 'E3', 'E5', 'E6'].slice(0, profile.keys),
    contradictionEvidenceIds: ['E3', 'E5'],
    redHerrings: herrings.map((evidenceId) => ({
      evidenceId,
      explanation: 'The suspicious record is explained by the continuous reception-desk alibi.',
    })),
  };
  return {
    plan,
    suspects,
    evidencePlan,
    evidence,
    explanation: {
      explanation:
        'Ada Vale used the spare key after losing her partnership. E1 establishes motive and access. E3 and E5 contradict her departure claim. The desk records exclude the other staff. All clues were available in the case.',
      evidenceIds: ['E1', 'E3', 'E5'],
    },
  };
}
export class MockGeminiProvider {
  constructor(fixture = caseFixture()) {
    this.fixture = fixture;
    this.calls = [];
  }
  async generate(stage, input, schema) {
    this.calls.push({ stage, input });
    let value;
    switch (stage) {
      case 'mystery-planner':
        value = this.fixture.plan;
        break;
      case 'suspect-generator':
        value = input.repairSuspect
          ? this.fixture.suspects.suspects.find((s) => s.id === input.repairSuspect.id)
          : this.fixture.suspects;
        break;
      case 'evidence-planner':
        value = this.fixture.evidencePlan;
        break;
      case 'evidence-generator':
        value = this.fixture.evidence[input.item.id];
        break;
      case 'solution-explainer':
        value = this.fixture.explanation;
        break;
      case 'consistency-validator':
        value = { pass: true, findings: [] };
        break;
      case 'blind-solver':
        value = {
          suspectId: 'S1',
          motiveOptionId: 'M1',
          evidenceIds: ['E1', 'E3'],
          reasoning:
            'The spare key, partnership letter and gallery coat contradict the departure claim.',
        };
        break;
      default:
        throw new Error(`Unknown mocked stage ${stage}`);
    }
    return schema.parse(structuredClone(value));
  }
}
