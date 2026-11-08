import {findLabSample, type LabSample} from '../../videos/style-lab/registry';
import {findStoryScene, STORY_SCENES, type StoryScene} from '../../videos/style-lab/redesign';
import {CINEMATIC_SCENES, cinematicForStory, findCinematicScene, type CinematicScene} from '../../videos/style-lab/cinematic';

/**
 * A scene family: every treatment of one idea from the first episode.
 *
 *   original   the legacy Style Lab sample that first attempted it (if any)
 *   redesign   the 2D story-driven scene
 *   cinematic  the 3D documentary-style reenactment
 *
 * The viewer shows one treatment and can compare it with another, beat for
 * beat. A family is reached from a story slug (`02-wrong-project`) or from a
 * cinematic slug (`cine-02-wrong-project`); the route only decides which
 * treatment opens first and which list the [ / ] keys walk.
 */
export type Concept = 'original' | 'redesign' | 'cinematic';
export const CONCEPTS: readonly Concept[] = ['original', 'redesign', 'cinematic'];

export type Family = {
  /** Route key: the story slug when there is one, else the cinematic slug. */
  readonly key: string;
  readonly number: number;
  readonly title: string;
  readonly understand: string;
  readonly legacy?: LabSample;
  readonly story?: StoryScene;
  readonly cinematic?: CinematicScene;
  /** Treatments that exist, in display order. */
  readonly concepts: readonly Concept[];
};

const build = (story: StoryScene | undefined, cinematic: CinematicScene | undefined): Family => {
  const legacy = findLabSample(story?.legacy ?? cinematic?.legacy);
  const concepts: Concept[] = [];
  if (legacy) concepts.push('original');
  if (story) concepts.push('redesign');
  if (cinematic) concepts.push('cinematic');
  const lead = story ?? cinematic!;
  return {key: story?.slug ?? cinematic!.slug, number: lead.number, title: lead.title, understand: lead.understand, legacy, story, cinematic, concepts};
};

export const familyForStory = (scene: StoryScene): Family => build(scene, cinematicForStory(scene.slug));
export const familyForCinematic = (scene: CinematicScene): Family => build(findStoryScene(scene.story), scene);

export type RouteKind = 'story' | 'cinematic';

/** Resolve a gallery slug to its family, the treatment that opens first and the list the [ / ] keys walk. */
export const familyForSlug = (slug: string | null | undefined): {family: Family; concept: Concept; route: RouteKind} | undefined => {
  if (!slug) return undefined;
  const cine = findCinematicScene(slug);
  if (cine) return {family: familyForCinematic(cine), concept: 'cinematic', route: 'cinematic'};
  const story = findStoryScene(slug);
  if (story) return {family: familyForStory(story), concept: 'redesign', route: 'story'};
  return undefined;
};

/** Neighbour family in the route's own list (wraps). */
export const siblingSlug = (route: RouteKind, slug: string, delta: number): string => {
  if (route === 'cinematic') {
    const i = CINEMATIC_SCENES.findIndex((s) => s.slug === slug);
    return CINEMATIC_SCENES[(i + delta + CINEMATIC_SCENES.length) % CINEMATIC_SCENES.length].slug;
  }
  const i = STORY_SCENES.findIndex((s) => s.slug === slug);
  return STORY_SCENES[(i + delta + STORY_SCENES.length) % STORY_SCENES.length].slug;
};

/** The first treatment of the family that is not `concept` (for "compare with the other one"). */
export const otherConcept = (family: Family, concept: Concept): Concept | undefined => {
  // Prefer the most "opposite" pairing: cinematic <-> redesign, redesign <-> original.
  const order: Record<Concept, Concept[]> = {
    cinematic: ['redesign', 'original'],
    redesign: ['cinematic', 'original'],
    original: ['cinematic', 'redesign'],
  };
  return order[concept].find((c) => family.concepts.includes(c));
};

export const isConcept = (v: unknown): v is Concept => typeof v === 'string' && (CONCEPTS as readonly string[]).includes(v);
