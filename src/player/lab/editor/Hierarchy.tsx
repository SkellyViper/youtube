import React from 'react';
import type {Selection, ShotDef, ShotState} from '../../../shot';
import type {ShotDraft} from './useShotDraft';

/**
 * Scene hierarchy: objects grouped as the shot declares them, then lights,
 * the camera and the stage look. The eye toggles visibility (a draft edit
 * like any other); a dot marks anything the draft changes.
 */
export const Hierarchy: React.FC<{
  readonly def: ShotDef;
  readonly state: ShotState;
  readonly draft: ShotDraft;
  readonly selection: Selection | null;
  readonly select: (s: Selection | null) => void;
}> = ({def, state, draft, selection, select}) => {
  const groups = new Map<string, string[]>();
  for (const [id, o] of Object.entries(def.objects)) groups.set(o.group, [...(groups.get(o.group) ?? []), id]);
  const isSel = (s: Selection) => selection !== null && selection.kind === s.kind && ('id' in s ? 'id' in selection && selection.id === s.id : true);
  const changed = (path: string[]) => draft.get(path) !== undefined;
  const shown = Object.values(state.objects).filter((o) => o.visible).length;

  return (
    <nav className="se-tree" aria-label="Scene hierarchy" data-testid="shot-hierarchy">
      <header className="se-tree-head">
        <span>Scene</span>
        <span className="se-dim">
          {shown}/{Object.keys(state.objects).length} objects shown
        </span>
      </header>
      {Array.from(groups.entries()).map(([group, ids]) => (
        <section key={group} className="se-tree-group">
          <h3>{group}</h3>
          <ul>
            {ids.map((id) => {
              const o = state.objects[id];
              return (
                <li key={id} data-selected={isSel({kind: 'object', id}) ? 'true' : 'false'} data-hidden={o.visible ? 'false' : 'true'}>
                  <button
                    type="button"
                    className="se-eye"
                    aria-label={`${o.visible ? 'Hide' : 'Show'} ${def.objects[id].label}`}
                    aria-pressed={o.visible}
                    data-testid={`eye-${id}`}
                    onClick={() => draft.set(['objects', id, 'visible'], !o.visible)}
                  >
                    {o.visible ? <EyeOpen /> : <EyeShut />}
                  </button>
                  <button type="button" className="se-node" data-testid={`node-${id}`} onClick={() => select({kind: 'object', id})}>
                    {def.objects[id].label}
                    {changed(['objects', id]) ? <span className="se-mod" aria-label="changed" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section className="se-tree-group">
        <h3>Lights</h3>
        <ul>
          {Object.entries(def.lights).map(([id, l]) => {
            const s = state.lights[id];
            return (
              <li key={id} data-selected={isSel({kind: 'light', id}) ? 'true' : 'false'} data-hidden={s.enabled ? 'false' : 'true'}>
                <button type="button" className="se-eye" aria-label={`${s.enabled ? 'Switch off' : 'Switch on'} ${l.label}`} aria-pressed={s.enabled} data-testid={`light-toggle-${id}`} onClick={() => draft.set(['lights', id, 'enabled'], !s.enabled)}>
                  <Bulb on={s.enabled} color={s.color || '#A6D6FF'} />
                </button>
                <button type="button" className="se-node" data-testid={`node-light-${id}`} onClick={() => select({kind: 'light', id})}>
                  {l.label}
                  <span className="se-role">{l.role}</span>
                  {changed(['lights', id]) ? <span className="se-mod" aria-label="changed" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="se-tree-group">
        <h3>Shot</h3>
        <ul>
          <li data-selected={isSel({kind: 'camera'}) ? 'true' : 'false'}>
            <button type="button" className="se-eye" aria-label={state.camera.locked ? 'Unlock camera' : 'Lock camera'} aria-pressed={state.camera.locked} data-testid="camera-lock-quick" onClick={() => draft.set(['camera', 'locked'], !state.camera.locked)}>
              <Lock locked={state.camera.locked} />
            </button>
            <button type="button" className="se-node" data-testid="node-camera" onClick={() => select({kind: 'camera'})}>
              Camera
              <span className="se-role">{state.camera.locked ? 'locked' : 'moves'}</span>
              {changed(['camera']) ? <span className="se-mod" aria-label="changed" /> : null}
            </button>
          </li>
          <li data-selected={isSel({kind: 'stage'}) ? 'true' : 'false'}>
            <span className="se-eye" />
            <button type="button" className="se-node" data-testid="node-stage" onClick={() => select({kind: 'stage'})}>
              Lighting + stage
              {changed(['stage']) ? <span className="se-mod" aria-label="changed" /> : null}
            </button>
          </li>
        </ul>
      </section>
    </nav>
  );
};

const EyeOpen = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="2" fill="currentColor" />
  </svg>
);
const EyeShut = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M1.5 6.5S4 10 8 10s6.5-3.5 6.5-3.5M4 9l-1.3 1.8M8 10v2M12 9l1.3 1.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const Bulb: React.FC<{readonly on: boolean; readonly color: string}> = ({on, color}) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <circle cx="8" cy="7" r="4.2" fill={on ? color : 'none'} fillOpacity={on ? 0.85 : 0} stroke="currentColor" strokeWidth="1.2" />
    <path d="M6.3 12.5h3.4M6.8 14.3h2.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
const Lock: React.FC<{readonly locked: boolean}> = ({locked}) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <rect x="3" y="7" width="10" height="7" rx="1.2" fill={locked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" />
    <path d={locked ? 'M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2' : 'M5.2 7V5a2.8 2.8 0 0 1 5.5-.8'} fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
