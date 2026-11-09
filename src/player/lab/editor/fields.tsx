import React, {useEffect, useRef, useState} from 'react';

/**
 * Inspector fields. Every field shows the effective value, marks itself when
 * the draft overrides it (a bar on the left), and offers a reset that removes
 * just that property from the draft.
 *
 * Numbers: type a value, use the arrow keys (Shift = x10, Alt = /10), or drag
 * the label sideways to scrub.
 */

type Common = {
  readonly label: string;
  readonly modified?: boolean;
  readonly onReset?: () => void;
  readonly hint?: string;
  readonly testId?: string;
};

const Row: React.FC<Common & {readonly children: React.ReactNode; readonly labelProps?: React.HTMLAttributes<HTMLSpanElement>}> = ({label, modified, onReset, hint, children, labelProps, testId}) => (
  <div className="se-field" data-modified={modified ? 'true' : 'false'} data-testid={testId} title={hint}>
    <span className="se-field-label" {...labelProps}>
      {label}
    </span>
    <span className="se-field-value">{children}</span>
    <button type="button" className="se-reset" onClick={onReset} disabled={!modified || !onReset} aria-label={`Reset ${label}`} title="Reset to the code value">
      ↺
    </button>
  </div>
);

const fmt = (v: number, step: number) => {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 2 : step >= 0.01 ? 3 : 4;
  return String(Number(v.toFixed(decimals)));
};

/** A number input that commits on every valid change and scrubs from its label. */
const NumberInput: React.FC<{readonly value: number; readonly step?: number; readonly min?: number; readonly max?: number; readonly onChange: (v: number) => void; readonly ariaLabel: string; readonly testId?: string}> = ({value, step = 0.01, min, max, onChange, ariaLabel, testId}) => {
  const [text, setText] = useState(fmt(value, step));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value, step));
  }, [value, step]);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  return (
    <input
      className="se-num"
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      data-testid={testId}
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(fmt(value, step));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(clamp(v));
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          return;
        }
        e.preventDefault();
        const k = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * step * (e.key === 'ArrowUp' ? 1 : -1);
        const v = clamp(Number((value + k).toFixed(6)));
        setText(fmt(v, step));
        onChange(v);
      }}
    />
  );
};

/** Drag a label sideways to scrub a number. */
const useScrub = (value: number, step: number, onChange: (v: number) => void, min?: number, max?: number): React.HTMLAttributes<HTMLSpanElement> => {
  const start = useRef<{x: number; v: number} | null>(null);
  return {
    className: 'se-field-label se-scrub',
    onPointerDown: (e) => {
      start.current = {x: e.clientX, v: value};
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const v = start.current.v + Math.round(dx / 2) * step * (e.shiftKey ? 10 : 1);
      onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number(v.toFixed(6)))));
    },
    onPointerUp: () => (start.current = null),
  };
};

export const NumberField: React.FC<Common & {readonly value: number; readonly step?: number; readonly min?: number; readonly max?: number; readonly onChange: (v: number) => void; readonly slider?: boolean}> = ({value, step = 0.01, min, max, onChange, slider, ...row}) => {
  const scrub = useScrub(value, step, onChange, min, max);
  return (
    <Row {...row} labelProps={scrub}>
      {slider && min !== undefined && max !== undefined ? (
        <input className="se-range" type="range" min={min} max={max} step={step} value={value} aria-label={`${row.label} slider`} onChange={(e) => onChange(Number(e.target.value))} />
      ) : null}
      <NumberInput value={value} step={step} min={min} max={max} onChange={onChange} ariaLabel={row.label} testId={row.testId ? `${row.testId}-input` : undefined} />
    </Row>
  );
};

export const Vec3Field: React.FC<Common & {readonly value: readonly number[]; readonly step?: number; readonly onChange: (v: [number, number, number]) => void}> = ({value, step = 0.01, onChange, ...row}) => (
  <Row {...row}>
    {(['x', 'y', 'z'] as const).map((axis, i) => (
      <label key={axis} className="se-axis">
        <span>{axis}</span>
        <NumberInput
          value={value[i]}
          step={step}
          ariaLabel={`${row.label} ${axis}`}
          testId={row.testId ? `${row.testId}-${axis}` : undefined}
          onChange={(v) => {
            const next: [number, number, number] = [value[0], value[1], value[2]];
            next[i] = v;
            onChange(next);
          }}
        />
      </label>
    ))}
  </Row>
);

const HEX = /^#[0-9a-fA-F]{6}$/;
export const ColorField: React.FC<Common & {readonly value: string; readonly onChange: (v: string) => void; readonly placeholder?: string}> = ({value, onChange, placeholder, ...row}) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Row {...row}>
      <input className="se-color" type="color" aria-label={`${row.label} colour`} value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} data-testid={row.testId ? `${row.testId}-color` : undefined} />
      <input
        className="se-hex"
        type="text"
        aria-label={`${row.label} hex`}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (HEX.test(e.target.value)) onChange(e.target.value.toUpperCase());
        }}
      />
    </Row>
  );
};

export const ToggleField: React.FC<Common & {readonly value: boolean; readonly onChange: (v: boolean) => void; readonly on?: string; readonly off?: string}> = ({value, onChange, on = 'On', off = 'Off', ...row}) => (
  <Row {...row}>
    <button type="button" className="se-toggle" role="switch" aria-checked={value} aria-label={row.label} data-testid={row.testId ? `${row.testId}-toggle` : undefined} onClick={() => onChange(!value)}>
      <span className="se-toggle-dot" />
      {value ? on : off}
    </button>
  </Row>
);

export const SelectField: React.FC<Common & {readonly value: string; readonly options: readonly {readonly value: string; readonly label: string}[]; readonly onChange: (v: string) => void}> = ({value, options, onChange, ...row}) => (
  <Row {...row}>
    <select className="se-select" value={value} aria-label={row.label} data-testid={row.testId ? `${row.testId}-select` : undefined} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </Row>
);

export const TextField: React.FC<Common & {readonly value: string; readonly onChange: (v: string) => void; readonly placeholder?: string}> = ({value, onChange, placeholder, ...row}) => (
  <Row {...row}>
    <input className="se-text" type="text" value={value} placeholder={placeholder} aria-label={row.label} onChange={(e) => onChange(e.target.value)} />
  </Row>
);

export const Section: React.FC<{readonly title: string; readonly children: React.ReactNode; readonly aside?: React.ReactNode}> = ({title, children, aside}) => (
  <section className="se-section">
    <header>
      <h3>{title}</h3>
      {aside}
    </header>
    {children}
  </section>
);
