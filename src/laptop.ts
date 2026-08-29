import { getSetting, setSetting } from './db';
import { parseReceiptText } from './receiptText';
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

  const parsed = parseReceiptText(lines.filter((l): l is string => typeof l === 'string'));
  if (parsed.items.length < 2) return null;

  return {
    merchant: parsed.merchant,
    purchased_on: parsed.purchased_on,
    total: parsed.total,
    items: parsed.items,
    model: 'laptop (PaddleOCR)',
  };
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
