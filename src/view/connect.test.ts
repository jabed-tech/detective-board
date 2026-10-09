import { describe, it, expect, vi } from 'vitest';
import { createConnect } from './connect';
import { createStore } from '../model/store';
import { addItem, makeItem, newBoard } from '../model/actions';

function setup(free = true) {
  let b = newBoard('t', 1);
  const a = makeItem('sticky', 500, 500);
  const c = makeItem('sticky', 900, 500);
  b = addItem(addItem(b, a), c);
  const store = createStore(b);
  const deps = {
    store,
    viewport: { toWorld: (x: number, y: number) => ({ x, y }), pinching: () => false },
    strings: { preview: vi.fn() },
    items: { setConnectFrom: vi.fn() },
    sfx: { pluck: vi.fn() },
    color: () => '#1f5fae',
    tension: () => 0.4,
    freeAnchors: () => free,
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
});
