import { describe, it, expect, vi } from 'vitest';
import { createConnect, previewEnd } from './connect';
import { createStore } from '../model/store';
import { addItem, makeItem, newBoard } from '../model/actions';

function setup(free = true, look: { material?: 'yarn' | 'twine' | 'marker'; thickness?: number } = {}) {
  let b = newBoard('t', 1);
  const a = makeItem('sticky', 500, 500);
  const c = makeItem('sticky', 900, 500);
  b = addItem(addItem(b, a), c);
  const store = createStore(b);
  const deps = {
    store,
    viewport: { toWorld: (x: number, y: number) => ({ x, y }), pinching: () => false },
    strings: { preview: vi.fn() },
    items: { setConnectFrom: vi.fn(), setHot: vi.fn() },
    sfx: { pluck: vi.fn() },
    color: () => '#1f5fae',
    tension: () => 0.4,
    freeAnchors: () => free,
    material: () => look.material ?? 'yarn',
    thickness: () => look.thickness ?? 1,
    announce: vi.fn(),
    onModeChange: vi.fn(),
    select: vi.fn(),
  };
  return { tool: createConnect(deps), deps, store, a, c };
}

describe('connect tool', () => {
  it('ignores taps when not in connect mode', () => {
    const { tool, store, a } = setup();
    expect(tool.tap(a.id)).toBe(false);
    expect(store.get().links).toHaveLength(0);
  });
  it('tap-tap in connect mode creates a link with current colour and tension', () => {
    const { tool, store, deps, a, c } = setup();
    tool.setMode(true);
    expect(deps.onModeChange).toHaveBeenCalledWith(true);
    expect(tool.tap(a.id)).toBe(true);
    expect(deps.items.setConnectFrom).toHaveBeenLastCalledWith(a.id);
    expect(tool.tap(c.id)).toBe(true);
    const l = store.get().links[0];
    expect([l.from, l.to, l.color, l.tension]).toEqual([a.id, c.id, '#1f5fae', 0.4]);
    expect(deps.sfx.pluck).toHaveBeenCalledOnce();
    expect(tool.pending()).toBeNull();
    expect(tool.mode()).toBe(true); // stays on for chaining
  });
  it('tap-tap stores the tapped anchors', () => {
    const { tool, store, a, c } = setup();
    tool.setMode(true);
    tool.tap(a.id, { u: 0.1, v: 0.2 });
    tool.tap(c.id, { u: -0.3, v: 0.4 });
    const l = store.get().links[0];
    expect([l.fromAt, l.toAt]).toEqual([{ u: 0.1, v: 0.2 }, { u: -0.3, v: 0.4 }]);
  });
  it('stores no anchors when free anchors are off', () => {
    const { tool, store, a, c } = setup(false);
    tool.setMode(true);
    tool.tap(a.id, { u: 0.1, v: 0.2 });
    tool.tap(c.id, { u: -0.3, v: 0.4 });
    const l = store.get().links[0];
    expect([l.fromAt, l.toAt]).toEqual([undefined, undefined]);
  });
  it('tapping the pending item again cancels', () => {
    const { tool, a } = setup();
    tool.setMode(true);
    tool.tap(a.id);
    tool.tap(a.id);
    expect(tool.pending()).toBeNull();
  });
  it('keyboard begin/complete works without mode', () => {
    const { tool, store, a, c } = setup();
    tool.begin(a.id);
    expect(tool.tap(c.id)).toBe(true);
    expect(store.get().links).toHaveLength(1);
    expect(store.get().links[0].fromAt).toBeUndefined();
    expect(store.get().links[0].toAt).toBeUndefined();
  });
  it('duplicate connections are announced, not added', () => {
    const { tool, store, deps, a, c } = setup();
    tool.begin(a.id); tool.complete(c.id);
    tool.begin(c.id);
    expect(tool.complete(a.id)).toBe(false);
    expect(store.get().links).toHaveLength(1);
    expect(deps.announce).toHaveBeenLastCalledWith('Those two are already connected.');
  });
  it('turning mode off clears the pending item', () => {
    const { tool, a } = setup();
    tool.setMode(true);
    tool.tap(a.id);
    tool.setMode(false);
    expect(tool.pending()).toBeNull();
  });
  it('shows an empty string preview while a source is pending, clears it on cancel', () => {
    const { tool, deps, a } = setup();
    tool.setMode(true);
    tool.tap(a.id);
    expect(deps.strings.preview.mock.calls.at(-1)![0]).not.toBeNull();
    tool.cancel();
    expect(deps.strings.preview).toHaveBeenLastCalledWith(null);
  });
  it('preview snaps to the target point, else follows the pointer', () => {
    expect(previewEnd({ x: 1, y: 2 }, { point: { x: 5, y: 6 } })).toEqual({ x: 5, y: 6 });
    expect(previewEnd({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });
  it('passes the current material and thickness to the new link', () => {
    const { tool, store, a, c } = setup(true, { material: 'twine', thickness: 1.6 });
    tool.setMode(true); tool.tap(a.id); tool.tap(c.id);
    const l = store.get().links[0];
    expect([l.material, l.thickness]).toEqual(['twine', 1.6]);
  });
  it('stores neither key for plain yarn at thickness 1', () => {
    const { tool, store, a, c } = setup(true, { material: 'yarn', thickness: 1 });
    tool.setMode(true); tool.tap(a.id); tool.tap(c.id);
    const l = store.get().links[0];
    expect('material' in l).toBe(false);
    expect('thickness' in l).toBe(false);
  });
});
