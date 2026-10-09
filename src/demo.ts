import { YARN_COLORS, type Board, type ItemData, type ItemType } from './model/types';
import { addItem, connect, makeItem, newBoard } from './model/actions';

export function createDemoBoard(): Board {
  let b = newBoard('The Case of the Missing Stapler', 1);
  const mk = (type: ItemType, x: number, y: number, data: ItemData, rot: number) => ({ ...makeItem(type, x, y, data), rot });
  const title = mk('index', 2000, 1050, { text: 'CASE #0001 — The Missing Stapler\nRed Swingline. Last seen Tuesday, 4:52 pm.' }, -2);
  const suspect = mk('polaroid', 1560, 1420, { caption: 'Gary, Accounts' }, -4);
  const witness = mk('index', 2470, 1450, { text: 'Witness: Linda (Reception)\n"Heard stapling after hours."' }, 3);
  const tip1 = mk('sticky', 1300, 1850, { text: 'Drag me around!' }, 3);
  const tip2 = mk('sticky', 2000, 1900, { text: 'Pull string from my pin, drop it on another note.' }, -3);
  const tip3 = mk('sticky', 2700, 1850, { text: "Pinch or Ctrl+scroll to zoom. Drag a string's middle to make it droop." }, 2);
  for (const it of [title, suspect, witness, tip1, tip2, tip3]) b = addItem(b, it);
  b = connect(b, title.id, suspect.id, { color: YARN_COLORS[0], tension: 0.5 });
  b = connect(b, title.id, witness.id, { color: YARN_COLORS[0], tension: 0.4 });
  b = connect(b, suspect.id, witness.id, { color: YARN_COLORS[1], tension: 0.7 });
  b = connect(b, suspect.id, tip1.id, { color: YARN_COLORS[3], tension: 0.6 });
  return b;
}
