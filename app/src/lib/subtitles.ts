export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

function parseTimecode(value: string): number | null {
  const match = value.trim().match(
    /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/
  );
  if (!match) {
    return null;
  }
  const hours = Number(match[1] ?? '0');
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = match[4].padEnd(3, '0');
  if (![hours, minutes, seconds].every((n) => Number.isFinite(n))) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds + Number(fraction) / 1000;
}

export function parseSrt(source: string): SubtitleCue[] {
  const blocks = source.replace(/^\uFEFF/, '').split(/\r?\n\r?\n/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length < 2) {
      continue;
    }
    const timeLine = lines[0].includes('-->') ? lines[0] : lines[1];
    const timeMatch = timeLine.match(/(.+?)\s+-->\s+(.+)/);
    if (!timeMatch) {
      continue;
    }
    const start = parseTimecode(timeMatch[1]);
    const end = parseTimecode(timeMatch[2]);
    if (start == null || end == null || end <= start) {
      continue;
    }
    const textLines = lines[0].includes('-->') ? lines.slice(1) : lines.slice(2);
    const text = textLines.join('\n').replace(/<[^>]+>/g, '').trim();
    if (!text) {
      continue;
    }
    cues.push({ start, end, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

function parseAssTime(value: string): number | null {
  const match = value.trim().match(/^(\d+):(\d{1,2}):(\d{1,2})[.](\d{1,3})$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const centis = Number(match[4].padEnd(2, '0').slice(0, 2));
  return hours * 3600 + minutes * 60 + seconds + centis / 100;
}

function stripAssOverrides(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[nN]/g, '\n')
    .replace(/\\h/g, ' ')
    .trim();
}

/**
 * Parse basic ASS/SSA dialogue lines. Style sections and drawing commands
 * are ignored; only start, end, and dialogue text are used.
 */
export function parseAss(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    if (!/^dialogue:/i.test(line)) {
      continue;
    }
    const payload = line.replace(/^dialogue:/i, '');
    const parts = payload.split(',');
    if (parts.length < 10) {
      continue;
    }
    const start = parseAssTime(parts[1] ?? '');
    const end = parseAssTime(parts[2] ?? '');
    if (start == null || end == null || end <= start) {
      continue;
    }
    const text = stripAssOverrides(parts.slice(9).join(','));
    if (!text) {
      continue;
    }
    cues.push({ start, end, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function parseSubtitleFile(name: string, source: string): SubtitleCue[] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.ass') || lower.endsWith('.ssa')) {
    return parseAss(source);
  }
  return parseSrt(source);
}

export function cueAtTime(
  cues: SubtitleCue[],
  time: number,
  offsetSec: number
): SubtitleCue | null {
  const t = time + offsetSec;
  for (const cue of cues) {
    if (t >= cue.start && t < cue.end) {
      return cue;
    }
  }
  return null;
}
