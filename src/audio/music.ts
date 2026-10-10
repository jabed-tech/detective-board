export interface Music {
  load(blob: Blob): Promise<boolean>; setOn(on: boolean): void; setVolume(v: number): void;
  setMuted(m: boolean): void; unlock(): void; settled(): boolean; clear(): void; playing(): boolean;
}

/** The user's own track, played from a local object URL. Nothing leaves the device. */
export function createMusic(makeAudio: () => HTMLAudioElement = () => new Audio()): Music {
  const audio = makeAudio();
  audio.loop = true;
  let url: string | null = null;
  let gen = 0;
  let loaded = false;
  let on = false;
  let muted = false;
  let unlocked = false;
  let attempt = 0; // bumped for every play() call, load and clear; stale results are ignored
  let confirmed = false; // true only once the current play() attempt has resolved

  // Any real pause (external or ours) means playback is no longer confirmed.
  audio.addEventListener('pause', () => { if (audio.paused) confirmed = false; });

  function revoke(): void {
    if (url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } url = null; }
  }
  function sync(): void {
    const want = on && !muted && unlocked && loaded;
    if (want && audio.paused) {
      const my = ++attempt;
      confirmed = false; // a new attempt is pending until its own promise resolves
      try {
        Promise.resolve(audio.play()).then(
          () => { if (my === attempt) confirmed = !audio.paused; },
          () => { if (my === attempt) confirmed = false; },
        );
      } catch { confirmed = false; }
    } else if (!want && !audio.paused) { attempt++; audio.pause(); confirmed = false; }
    else if (!want) confirmed = false;
  }

  return {
    load(blob) {
      attempt++;
      audio.pause();
      confirmed = false;
      revoke();
      loaded = false;
      const my = ++gen;
      const myUrl = url = URL.createObjectURL(blob);
      return new Promise<boolean>(resolve => {
        let done = false;
        const finish = (ok: boolean): void => {
          if (done) return;
          done = true;
          const stale = my !== gen;
          clearTimeout(timer);
          audio.removeEventListener('loadedmetadata', onOk);
          audio.removeEventListener('error', onErr);
          if (stale) { resolve(false); return; }
          if (ok) { loaded = true; sync(); } else { revoke(); }
          resolve(ok);
        };
        const onOk = (): void => finish(true);
        const onErr = (): void => finish(false);
        const timer = setTimeout(() => finish(false), 8000);
        audio.addEventListener('loadedmetadata', onOk);
        audio.addEventListener('error', onErr);
        audio.src = myUrl;
        audio.load();
      });
    },
    setOn(v) { on = v; sync(); },
    setVolume(v) { audio.volume = Math.min(1, Math.max(0, v)); },
    setMuted(m) { muted = m; sync(); },
    unlock() { unlocked = true; sync(); }, // later calls retry a rejected play()
    settled() { return !(on && !muted && loaded) || (confirmed && !audio.paused); },
    clear() {
      gen++; attempt++;
      on = false; loaded = false; confirmed = false;
      audio.pause();
      revoke();
      audio.src = '';
    },
    playing() { return !audio.paused && loaded && on && !muted; },
  };
}
