import type { TravelMode } from './types';

export function iconForManeuver(type: string, modifier?: string): string {
  if (type === 'depart') return 'navigate';
  if (type === 'arrive') return 'flag';
  if (type.includes('roundabout') || type === 'rotary') return 'sync';
  if (!modifier) return 'arrow-up';
  if (modifier.includes('sharp right')) return 'return-down-forward';
  if (modifier.includes('slight right')) return 'arrow-up';
  if (modifier === 'right') return 'arrow-forward';
  if (modifier.includes('sharp left')) return 'return-down-back';
  if (modifier.includes('slight left')) return 'arrow-up';
  if (modifier === 'left') return 'arrow-back';
  if (modifier === 'uturn') return 'arrow-undo';
  return 'arrow-up';
}

export function iconForMode(mode: TravelMode): string {
  switch (mode) {
    case 'car':
      return 'car-sport';
    case 'bus':
      return 'bus';
    case 'cycle':
      return 'bicycle';
    case 'walk':
      return 'walk';
  }
}

export function labelForMode(mode: TravelMode): string {
  switch (mode) {
    case 'car':
      return 'Drive';
    case 'bus':
      return 'Bus';
    case 'cycle':
      return 'Cycle';
    case 'walk':
      return 'Walk';
  }
}
