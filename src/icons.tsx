import React from 'react';
import { View } from 'react-native';
import {
  Baby, Banknote, BarChart3, BedDouble, Beer, Bike, BookOpen, Briefcase, Building2, Bus, Cake, Camera,
  Car, CarTaxiFront, Clapperboard, Coffee, Coins, CreditCard, Dog, Droplet, Dumbbell, Flame, Fuel,
  Gamepad2, Gift, GraduationCap, Heart, HeartPulse, House, Landmark, Layers, Leaf, Lightbulb, MapPin,
  Music, Package, Phone, PiggyBank, Pill, Plane, Receipt, Repeat, Scissors, Shirt, ShoppingBag,
  ShoppingCart, Smartphone, Sparkles, Star, Stethoscope, Tag, TrainFront, TrendingUp, TriangleAlert,
  Tv, Undo2, Users, UtensilsCrossed, Wallet, Wifi, Wrench, Zap,
} from 'lucide-react-native';
import { radius } from './theme';

type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Mirrors web/src/lib/icons.tsx so both apps store the same icon names. */
export const ICON_MAP: Record<string, IconCmp> = {
  utensils: UtensilsCrossed, cart: ShoppingCart, bus: Bus, taxi: CarTaxiFront, fuel: Fuel,
  bolt: Zap, bulb: Lightbulb, house: House, bag: ShoppingBag, stethoscope: Stethoscope,
  pulse: HeartPulse, film: Clapperboard, repeat: Repeat, plane: Plane, cap: GraduationCap,
  scissors: Scissors, gift: Gift, alert: TriangleAlert, users: Users, trending: TrendingUp,
  bank: Landmark, package: Package, wallet: Wallet, briefcase: Briefcase, coins: Coins,
  undo: Undo2, sparkles: Sparkles, coffee: Coffee, beer: Beer, dog: Dog, gamepad: Gamepad2,
  car: Car, phone: Smartphone, pill: Pill, receipt: Receipt, shirt: Shirt, dumbbell: Dumbbell,
  baby: Baby, wifi: Wifi, droplet: Droplet, flame: Flame, music: Music, camera: Camera,
  book: BookOpen, bike: Bike, train: TrainFront, bed: BedDouble, wrench: Wrench, card: CreditCard,
  piggy: PiggyBank, building: Building2, pin: MapPin, call: Phone, tv: Tv, cake: Cake,
  leaf: Leaf, star: Star, heart: Heart, note: Banknote, tag: Tag, layers: Layers, chart: BarChart3,
};

export const ICON_CHOICES = Object.keys(ICON_MAP);

/** Categories seeded before the icon set existed store an emoji. */
const EMOJI_TO_ICON: Record<string, string> = {
  '🍜': 'utensils', '🛒': 'cart', '🚕': 'taxi', '⛽': 'fuel', '💡': 'bulb', '🏠': 'house',
  '🛍️': 'bag', '🩺': 'stethoscope', '🎬': 'film', '🔁': 'repeat', '✈️': 'plane', '📚': 'cap',
  '💇': 'scissors', '🎁': 'gift', '⚡': 'alert', '👨‍👩‍👧': 'users', '📈': 'trending',
  '🏦': 'bank', '📦': 'package', '💰': 'wallet', '💼': 'briefcase', '🪙': 'coins',
  '↩️': 'undo', '✨': 'sparkles', '☕': 'coffee', '🍺': 'beer', '🐶': 'dog', '🎮': 'gamepad',
  '🚗': 'car', '📱': 'phone', '💊': 'pill', '🧾': 'receipt', '💵': 'note', '💳': 'card',
  '👛': 'wallet', '🏧': 'bank', '💎': 'star',
};

export function resolveIconName(stored: string | null | undefined): string {
  if (!stored) return 'package';
  if (ICON_MAP[stored]) return stored;
  return EMOJI_TO_ICON[stored] ?? 'package';
}

export function CategoryIcon({
  name,
  size = 18,
  color,
  strokeWidth = 2.1,
}: {
  name: string | null | undefined;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICON_MAP[resolveIconName(name)] ?? Package;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}

/** Icon in a soft tinted tile — the standard way categories appear in lists. */
export function IconTile({
  name,
  color,
  size = 38,
}: {
  name: string | null | undefined;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: color + '1f',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CategoryIcon name={name} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}
