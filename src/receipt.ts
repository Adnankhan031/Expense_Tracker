import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

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

/** Take a photo of a receipt. Returns null when the user backs out. */
export async function captureReceipt(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera access is off for Spendly. Turn it on in Settings.');

  const shot = await ImagePicker.launchCameraAsync({ quality: 1, exif: false });
  if (shot.canceled || !shot.assets?.[0]) return null;
  return toDataUrl(shot.assets[0].uri);
}

/** Pick an existing photo of a receipt. Returns null when the user backs out. */
export async function pickReceipt(): Promise<string | null> {
  const shot = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  });
  if (shot.canceled || !shot.assets?.[0]) return null;
  return toDataUrl(shot.assets[0].uri);
}

/**
 * Send the photo to the Edge Function and get the receipt's lines back.
 *
 * The OpenRouter key lives on the function, never in this bundle — anything
 * shipped in the app is extractable, as the Supabase key in the APK showed.
 */
export async function readReceipt(dataUrl: string): Promise<ScannedReceipt> {
  const { data, error } = await supabase().functions.invoke('read-receipt', {
    body: { image: dataUrl },
  });

  if (error) throw new Error(await messageFrom(error));
  if (!data || typeof data !== 'object') throw new Error('The receipt reader returned nothing.');
  if ('error' in data) throw new Error(String((data as { error: string }).error));

  return data as ScannedReceipt;
}

/** The function's own error body says more than "non-2xx status". */
async function messageFrom(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* fall through */
    }
  }
  return error instanceof Error ? error.message : 'Could not reach the receipt reader.';
}
