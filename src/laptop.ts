import { getSetting, setSetting } from './db';
import { looksWrong, parseReceiptText } from './receiptText';
import type { ScannedReceipt } from './receipt';

/**
 * The service running on your own machine.
 *
 * It answers the two questions the free cloud tier rations — read this photo,
 * translate these names — with no daily limit. It is second in line rather
 * than first because the cloud model reads a receipt more accurately and the
 * laptop has to be awake; it takes over the moment the quota runs out.
 *
 * Only the OCR and the translation happen there. Parsing and classification
 * stay on the phone, where they are already tested, so there is one copy of
 * the receipt rules rather than two that drift apart.
 */

export type LaptopConfig = { url: string; key: string };

export function laptopConfig(): LaptopConfig | null {
  const url = (getSetting('laptop.url') ?? '').trim().replace(/\/+$/, '');
  const key = (getSetting('laptop.key') ?? '').trim();
  if (!url) return null;
  return { url, key };
}

/**
 * Which reader to try first.
 *
 * The cloud is more accurate and much faster but rationed; the laptop is slower
 * and unlimited. This only sets the order — whichever is chosen, the other is
 * still tried if the first cannot answer, because a scan that fails entirely
 * is worse than a slow one.
 */
export function preferCloud(): boolean {
  return (getSetting('reader.preferCloud') ?? '1') !== '0';
}

export function setPreferCloud(on: boolean) {
  setSetting('reader.preferCloud', on ? '1' : '0');
}

export function saveLaptopConfig(url: string, key: string) {
  setSetting('laptop.url', url.trim().replace(/\/+$/, ''));
  setSetting('laptop.key', key.trim());
}

async function call(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const cfg = laptopConfig();
  if (!cfg) throw new Error('No laptop service configured.');

  // Without a timeout a sleeping laptop hangs the scan indefinitely; the point
  // of the fallback is that it either answers or gets out of the way.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${cfg.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.key ? { 'X-Spendly-Key': cfg.key } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** True when the service answers. Used to tell "asleep" from "misconfigured". */
export async function laptopReachable(): Promise<boolean> {
  const cfg = laptopConfig();
  if (!cfg) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${cfg.url}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Read a receipt on the laptop.
 *
 * PaddleOCR returns the lines; the phone's own parser turns them into items,
 * exactly as it does for the on-device reader.
 */
export async function readViaLaptop(dataUrl: string): Promise<ScannedReceipt | null> {
  const res = await call('/read', { image: dataUrl }, 120000);
  if (!res.ok) throw new Error(`Laptop reader failed (${res.status}).`);

  const body = await res.json();
  const lines: unknown = body?.lines;
  if (!Array.isArray(lines) || lines.length < 4) return null;

  const text = lines.filter((l): l is string => typeof l === 'string');
  const parsed = parseReceiptText(text);

  const receipt: ScannedReceipt = {
    merchant: parsed.merchant,
    purchased_on: parsed.purchased_on,
    total: parsed.total,
    items: parsed.items,
    model: 'laptop (PaddleOCR)',
  };

  // Rules first, model only when they clearly failed.
  if (!looksWrong(receipt, text.length)) return receipt;

  const viaModel = await extractViaLaptop(text);
  return viaModel ?? (receipt.items.length >= 2 ? receipt : null);
}

/**
 * Structure a receipt with the local model, when the rules could not.
 *
 * Deliberately a fallback. The parser is deterministic and provable; a model
 * that returns nineteen items one run and twenty-one the next cannot be held
 * to a test. This is for the layouts the rules have never seen.
 */
export async function extractViaLaptop(lines: string[]): Promise<ScannedReceipt | null> {
  if (!lines.length) return null;
  try {
    const res = await call('/extract', { lines }, 240000);
    if (!res.ok) return null;

    const body = await res.json();
    const raw: unknown = body?.items;
    if (!Array.isArray(raw) || raw.length < 2) return null;

    const items = raw
      .filter(
        (i): i is { name: string; amount: number } =>
          !!i && typeof i.name === 'string' && Number.isFinite(i.amount)
      )
      // The model reports printed yen; the app stores minor units.
      .map((i) => ({ name: i.name.trim(), amount_minor: Math.round(i.amount * 100) }))
      .filter((i) => i.name && i.amount_minor !== 0);

    if (items.length < 2) return null;

    const total = Number(body?.total);
    return {
      merchant: typeof body?.merchant === 'string' ? body.merchant : null,
      purchased_on: typeof body?.purchased_on === 'string' ? body.purchased_on : null,
      total: Number.isFinite(total) && total > 0 ? Math.round(total * 100) : null,
      items,
      model: `laptop (${body?.model ?? 'local model'})`,
    };
  } catch {
    return null;
  }
}

/** Translate on the laptop. Returns null when it cannot help, never throws. */
export async function translateViaLaptop(names: string[]): Promise<string[] | null> {
  if (!names.length) return [];
  try {
    const res = await call('/translate', { names }, 180000);
    if (!res.ok) return null;
    const body = await res.json();
    const list: unknown = body?.translations;
    if (!Array.isArray(list) || list.length !== names.length) return null;
    return list.map((t, i) => (typeof t === 'string' && t.trim() ? t.trim() : names[i]));
  } catch {
    return null;
  }
}
