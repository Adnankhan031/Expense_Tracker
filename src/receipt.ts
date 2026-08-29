import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

import { parseReceiptText } from './receiptText';
import { supabase, supabaseConfig } from './supabase';

export type ScannedItem = { name: string; amount_minor: number; qty?: number };
export type ScannedReceipt = {
  merchant: string | null;
  purchased_on: string | null;
  total: number | null;
  items: ScannedItem[];
  model?: string;
};

/**
 * A receipt photo, resized and encoded ready to send.
 *
 * Phone cameras produce 3–6MB, which is slow on mobile data and mostly wasted —
 * receipt text stops gaining legibility well below full sensor resolution.
 * 1600px on the long edge keeps small print readable at roughly 200–400KB.
 */
async function toDataUrl(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri).resize({ width: 1600 });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not read that photo.');
  return `data:image/jpeg;base64,${out.base64}`;
}

/**
 * Read the receipt on the phone, with no network and no quota.
 *
 * ML Kit is a dedicated OCR engine rather than a general model guessing at
 * pixels, so it is both faster and free to run as often as you like. It returns
 * text, not structure; `parseReceiptText` supplies the structure.
 *
 * Returns null when the text does not look like a receipt, so the caller can
 * fall back to the cloud reader rather than showing an empty draft.
 */
export async function readReceiptOnDevice(uri: string): Promise<ScannedReceipt | null> {
  const result = await TextRecognition.recognize(uri, TextRecognitionScript.JAPANESE);
  const lines = result.blocks.flatMap((b) => b.lines.map((l) => l.text));
  if (lines.length < 4) return null;

  const parsed = parseReceiptText(lines);
  // One or two lines is more likely a misread sign than a shopping trip.
  if (parsed.items.length < 2) return null;

  return {
    merchant: parsed.merchant,
    purchased_on: parsed.purchased_on,
    total: parsed.total,
    items: parsed.items,
    model: 'on-device',
  };
}

/** Take a photo of a receipt. Returns null when the user backs out. */
export type Shot = { uri: string; dataUrl: string };

export async function captureReceipt(): Promise<Shot | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera access is off for Spendly. Turn it on in Settings.');

  const shot = await ImagePicker.launchCameraAsync({ quality: 1, exif: false });
  if (shot.canceled || !shot.assets?.[0]) return null;
  return { uri: shot.assets[0].uri, dataUrl: await toDataUrl(shot.assets[0].uri) };
}

/** Pick an existing photo of a receipt. Returns null when the user backs out. */
export async function pickReceipt(): Promise<Shot | null> {
  const shot = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  });
  if (shot.canceled || !shot.assets?.[0]) return null;
  return { uri: shot.assets[0].uri, dataUrl: await toDataUrl(shot.assets[0].uri) };
}

/**
 * Send the photo to the Edge Function and get the receipt's lines back.
 *
 * Deliberately plain fetch rather than `functions.invoke`. The client wraps any
 * non-2xx as "Edge Function returned a non-2xx status code" and discards the
 * body, so a spent quota, an oversized image and an unreadable photo all
 * arrived looking identical — with nothing to act on. The function already
 * returns a precise reason; this keeps it.
 */
export async function readReceipt(dataUrl: string): Promise<ScannedReceipt> {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error('Sync is not configured in this build.');

  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token ?? key;

  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/read-receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: dataUrl }),
    });
  } catch {
    throw new Error('No connection. The receipt reader needs the internet.');
  }

  const body = await res.text();
  let parsed: (ScannedReceipt & { error?: string }) | null = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* not JSON — fall through to the status-based message */
  }

  if (!res.ok) {
    if (parsed?.error) throw new Error(parsed.error);
    if (res.status === 404) throw new Error('The read-receipt function is not deployed on this project.');
    if (res.status === 401 || res.status === 403) throw new Error('Sign in again — the session was rejected.');
    throw new Error(`The receipt reader failed (${res.status}). ${body.slice(0, 140)}`);
  }

  if (!parsed) throw new Error('The receipt reader returned something unreadable.');
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}
