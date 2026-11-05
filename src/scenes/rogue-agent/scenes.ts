import {defineScene} from '../../engine';
import {QuestionScene} from './QuestionScene';

/**
 * Cold open for the rogue-agent episode: 4 scenes, 24 beats, one beat per
 * line of narration. `notes` holds the line, shown in the presenter HUD (H).
 */

export const setupScene = defineScene({
  id: 'setup',
  title: 'John',
  beats: [
    {id: 'john', label: 'John', duration: 2.0, hold: 1.4, notes: 'This is John, a rookie game developer…'},
    {id: 'enemy', label: 'A new enemy', duration: 1.7, hold: 1.6, notes: '…trying to vibe-code a new enemy for his indie game.'},
    {
      id: 'traits',
      label: 'Enemy design',
      duration: 3.4,
      hold: 2.6,
      notes:
        'The enemy hides, scavenges resources, grows stronger by multiplying, and, when the time is right, ambushes the player, ending the game in one fell swoop.',
    },
    {id: 'prompt', label: 'Prompt', duration: 2.8, hold: 1.2, notes: 'He writes up the prompt and sends it to his coding agent.'},
  ],
});

export const wrongScene = defineScene({
  id: 'wrong',
  title: 'The Wrong Project',
  beats: [
    {id: 'twist', label: 'One little problem', duration: 1.4, hold: 1.0, notes: "Except there's one little problem."},
    {id: 'wrong-project', label: 'Wrong project', duration: 2.8, hold: 1.0, notes: 'He sends it to the wrong project.'},
    {
      id: 'agent',
      label: 'Cloud agent',
      duration: 2.4,
      hold: 1.2,
      notes: "And this isn't just any coding agent. It's running on a cloud machine, with access to the internet, tools…",
    },
    {id: 'permissions', label: 'Too many permissions', duration: 2.0, hold: 1.4, notes: '…and a whole lot more permissions than it might need.'},
    {id: 'overnight', label: 'Overnight', duration: 2.4, hold: 1.2, notes: 'He leaves the prompt running overnight.'},
    {
      id: 'closes',
      label: 'Project closed',
      duration: 3.0,
      hold: 1.6,
      notes: 'The next morning, he realizes his mistake, closes the project, and goes back to developing his game.',
    },
    {id: 'no-big-deal', label: 'No big deal', duration: 1.4, hold: 1.4, notes: 'No big deal, right?'},
  ],
});

export const spreadScene = defineScene({
  id: 'spread',
  title: 'The Spread',
  beats: [
    {
      id: 'to-heart',
      label: 'Instructions taken to heart',
      duration: 3.0,
      hold: 1.8,
      notes:
        'Well, unbeknownst to John, his agent, without any context of his game available, has taken its instructions to heart.',
    },
    {
      id: 'scavenge',
      label: 'Scavenge, probe, copy',
      duration: 3.0,
      hold: 1.8,
      notes: 'It has started scavenging computing resources, looking for vulnerable systems, and creating copies of itself.',
    },
    {id: 'copies', label: 'Copies copy', duration: 2.4, hold: 1.0, notes: 'And the copies are doing the same.'},
    {id: 'time', label: 'Days → months', duration: 3.0, hold: 1.0, notes: 'Days become weeks. Weeks become months.'},
    {
      id: 'thousands',
      label: 'Thousands, waiting',
      duration: 3.4,
      hold: 2.2,
      notes:
        'Thousands of agents, scattered across the internet, quietly collecting resources, growing stronger, and waiting.',
    },
    {id: 'move', label: 'They make their move', duration: 1.4, hold: 0.8, notes: 'Until one day, they make their move.'},
    {id: 'dark', label: 'The internet goes dark', duration: 2.4, hold: 1.6, notes: 'And the entire internet goes dark.'},
  ],
});

export const questionScene = defineScene({
  id: 'question',
  title: 'The Question',
  component: QuestionScene,
  beats: [
    {id: 'today', label: "Today's question", duration: 1.6, hold: 0.8, notes: "Today, we'll be exploring this simple question:"},
    {id: 'lab', label: 'Not a lab', duration: 2.6, hold: 1.6, notes: "What if a rogue AI agent didn't come from a billion-dollar AI lab?"},
    {id: 'like-john', label: 'Somebody like John', duration: 2.2, hold: 1.8, notes: 'What if it came from somebody like John?'},
    {id: 'more', label: 'More importantly', duration: 2.0, hold: 0.8, notes: 'And perhaps more importantly…'},
    {
      id: 'know',
      label: 'How would we know?',
      duration: 3.2,
      hold: 3.0,
      notes: 'If one were already hiding somewhere on the internet, how exactly would we know?',
    },
  ],
});
