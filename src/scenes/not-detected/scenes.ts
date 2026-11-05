import {defineScene} from '../../engine';
import {ConclusionScene} from './ConclusionScene';

/**
 * Narrative structure of the demo: 4 scenes, 11 beats.
 * `duration` = animation seconds; `hold` = export-only pause on the result.
 * In presentation mode each beat is triggered by ArrowRight and holds forever.
 */

export const claimScene = defineScene({
  id: 'claim',
  title: 'The Claim',
  beats: [
    {
      id: 'title',
      label: 'Claim appears',
      duration: 1.9,
      hold: 1.3,
      notes: 'The report says: no bugs detected.',
    },
    {
      id: 'evidence',
      label: 'Evidence counts up',
      duration: 1.6,
      hold: 1.5,
      notes: 'And it has evidence: every node checked, full coverage.',
    },
  ],
});

export const observationScene = defineScene({
  id: 'observation',
  title: 'The Observation',
  beats: [
    {
      id: 'system',
      label: 'System assembles',
      duration: 2.2,
      hold: 0.9,
      notes: 'Here is the system the scanner looked at.',
    },
    {
      id: 'scan',
      label: 'Scanner sweep',
      duration: 2.8,
      hold: 0.8,
      notes: 'It sweeps every node, every connection.',
    },
    {
      id: 'clear',
      label: 'Area marked clear',
      duration: 1.4,
      hold: 1.5,
      notes: 'Nothing found. The area is clear.',
    },
  ],
});

export const blindSpotScene = defineScene({
  id: 'blind-spot',
  title: 'The Blind Spot',
  beats: [
    {
      id: 'zoom-out',
      label: 'Camera pulls back',
      duration: 2.9,
      hold: 1.3,
      notes: 'But that area was one module of a much larger system.',
    },
    {
      id: 'ground-truth',
      label: 'Ground truth ripple',
      duration: 2.2,
      hold: 1.4,
      notes: 'And the bugs were there all along, just never looked at.',
    },
    {
      id: 'recount',
      label: 'Coverage recount',
      duration: 1.9,
      hold: 1.8,
      notes: '100% of what it scanned is a small fraction of what exists.',
    },
  ],
});

export const conclusionScene = defineScene({
  id: 'conclusion',
  title: 'The Conclusion',
  component: ConclusionScene,
  beats: [
    {
      id: 'assemble',
      label: 'System becomes ≠',
      duration: 2.5,
      hold: 0.7,
      notes: 'So what does a negative result actually tell us?',
    },
    {
      id: 'statement',
      label: 'Statement',
      duration: 1.6,
      hold: 1.5,
      notes: 'Not detected is not the same as does not exist.',
    },
    {
      id: 'coda',
      label: 'Coda',
      duration: 1.6,
      hold: 2.2,
      notes: 'Absence of evidence is not evidence of absence.',
    },
  ],
});
