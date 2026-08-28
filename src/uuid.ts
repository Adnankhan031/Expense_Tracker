/**
 * RFC 4122 v4 identifiers, generated in plain JavaScript.
 *
 * Local rows have to carry the same id as their Supabase counterpart, and that
 * column is a uuid — so ids must be real uuids rather than the short slugs this
 * app used to mint. Deliberately no native crypto module: keeping this pure JS
 * means the whole sync feature still ships as an over-the-air update.
 *
 * Math.random is not cryptographically strong, which does not matter here. These
 * are row identifiers, never secrets, and the odds of a collision across one
 * person's expense history are far beyond negligible.
 */
const HEX: string[] = [];
for (let i = 0; i < 256; i++) HEX.push((i + 0x100).toString(16).slice(1));

export function uuid(): string {
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;

  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10

  return (
    HEX[b[0]] + HEX[b[1]] + HEX[b[2]] + HEX[b[3]] + '-' +
    HEX[b[4]] + HEX[b[5]] + '-' +
    HEX[b[6]] + HEX[b[7]] + '-' +
    HEX[b[8]] + HEX[b[9]] + '-' +
    HEX[b[10]] + HEX[b[11]] + HEX[b[12]] + HEX[b[13]] + HEX[b[14]] + HEX[b[15]]
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: string | null | undefined): boolean => !!s && UUID_RE.test(s);
