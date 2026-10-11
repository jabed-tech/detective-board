# Task 5: Clip sourcing, browser verification, review — wave C (Opus, controller)

The controller does this task, not a subagent.

## A. Clips (can start during wave A)

1. Search CC0 sources: Freesound with the CC0 licence filter, OpenGameArt CC0, and BigSoundBank. Shortlist 8–10 clips covering:
   - desk/old bell phone ring (×2–3)
   - office chatter murmur (×2)
   - a one-sided phone call fragment with no intelligible personal details (×2)
   - TV or voices through a wall (×2)

   For each clip: link, licence, length and a one-line description.
2. Show the shortlist to the user. Download only the clips the user approves, each into its own new empty folder under the scratchpad. Where a login is required, the user downloads.
3. Convert to mono MP3 at ~48 kbps, trimmed to 3–15 s: `ffmpeg -i in -ac 1 -b:a 48k -t 15 out.mp3` (check that ffmpeg exists first; otherwise ask the user). Total ≤ 400 KB. Place them in `public/audio/incidents/`.
4. Fill `CLIPS` in `src/audio/incidents.ts` (ids, files, kinds, moods per spec §5) and add a "Sound credits" section to `README.md`. Commit.

## B. Browser checks (127.0.0.1:5174; never the user's localhost data)

1. **Frame:** all 5 moods show their own tab bar, tabs, desk, menus, drawer, dialogs and room. Text is readable, the focus ring is yellow, and the 390 px layout works.
2. **Brick:** a photo is about one and a half bricks wide, with no tile seams; the export matches.
3. **Acrylic:** reads as clear plastic in front of a blurred room; new items use tape; shadows are far and soft; old magnet items still render; the export matches.
4. **Ambience:** one sound per mood. Noir has jazz only and no rain sound. The volume default is 20% for a fresh profile.
5. **Incidents:** a temporary dev console call shortens the gap. Check:
   - a clip plays muffled and panned
   - no overlap
   - a mood switch restarts the layer
   - mute and a hidden tab silence it
   - a missing file causes no error
6. Reduced-motion emulation: nothing in the frame animates.
7. `npm test`, `npx tsc --noEmit`, `npm run build` all clean; no console errors.

## C. Review

- One Opus whole-branch review of `master..phase-2b` against the spec and this plan.
- One fix wave for Critical/Important findings; minors go to the ledger.
- Update `docs/HANDOFF.md`, then ask the user about merging (local only).
