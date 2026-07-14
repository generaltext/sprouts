// One icon per activity kind (lucide line icons, matching the app's weight).

import { Activity, Baby, Droplets, Milk, Moon, type LucideIcon, Pill, Ruler, Star, StickyNote, Utensils, Heart } from 'lucide-react'
import type { EntryKind } from '~/lib/types'

export const KIND_ICON: Record<EntryKind, LucideIcon> = {
  sleep: Moon,
  'feed.bottle': Milk,
  'feed.breast': Heart,
  'feed.pump': Droplets,
  'feed.solid': Utensils,
  diaper: Baby,
  growth: Ruler,
  tummy: Activity,
  medicine: Pill,
  milestone: Star,
  note: StickyNote,
}
