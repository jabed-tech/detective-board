/** Greedy word wrap. Keeps explicit newlines; hard-breaks words wider than maxWidth. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    const push = () => { out.push(line); line = ''; };
    for (const word of para.split(' ')) {
      const trial = line ? `${line} ${word}` : word;
      if (measure(trial) <= maxWidth) { line = trial; continue; }
      if (line) push();
      let rest = word;
      while (measure(rest) > maxWidth && rest.length > 1) {
        let n = rest.length - 1;
        while (n > 1 && measure(rest.slice(0, n)) > maxWidth) n--;
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    push();
  }
  return out;
}
