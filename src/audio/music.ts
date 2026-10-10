export interface Music {
  load(blob: Blob): Promise<boolean>; setOn(on: boolean): void; setVolume(v: number): void;
  setMuted(m: boolean): void; unlock(): void; clear(): void; playing(): boolean;
}

/** The user's own track, played from a local object URL. Nothing leaves the device. */
export function createMusic(makeAudio: () => HTMLAudioElement = () => new Audio()): Music {
  const audio = makeAudio();
  audio.loop = true;
  let url: string | null = null;
  let loaded = false;
  let on = false;
  let muted = false;
  let unlocked = false;

  function revoke(): void {
    if (url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } url = null; }
  }
  function sync(): void {
    const want = on && !muted && unlocked && loaded;
    if (want && audio.paused) { try { void Promise.resolve(audio.play()).catch(() => {}); } catch { /* ignore */ } }
    else if (!want && !audio.paused) audio.pause();
  }

  return {
    load(blob) {
      audio.pause();
      revoke();
      loaded = false;
      url = URL.createObjectURL(blob);
      return new Promise<boolean>(resolve => {
        let done = false;
        const finish = (ok: boolean): void => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          audio.removeEventListener('loadedmetadata', onOk);
          audio.removeEventListener('error', onErr);
          if (ok) { loaded = true; sync(); } else { revoke(); }
          resolve(ok);
        };
        const onOk = (): void => finish(true);
        const onErr = (): void => finish(false);
        const timer = setTimeout(() => finish(false), 8000);
        audio.addEventListener('loadedmetadata', onOk);
        audio.addEventListener('error', onErr);
        audio.src = url!;
        audio.load();
      });
    },
    setOn(v) { on = v; sync(); },
    setVolume(v) { audio.volume = Math.min(1, Math.max(0, v)); },
    setMuted(m) { muted = m; sync(); },
    unlock() { unlocked = true; sync(); },
    clear() {
      on = false; loaded = false;
      audio.pause();
      revoke();
      audio.src = '';
    },
    playing() { return !audio.paused && loaded && on && !muted; },
  };
}
