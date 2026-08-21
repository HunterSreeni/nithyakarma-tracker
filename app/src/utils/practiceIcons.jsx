import {
  Sunrise, Sun, Waves, BookOpen, TreeDeciduous, Library, Sparkles,
  Flag, Feather, Sword, Music2, Landmark, Flame, Lamp,
} from 'lucide-react'

// Custom marks for practices with no good stock-icon match, drawn in Lucide's
// own convention (24x24, stroke-width 2, round caps/joins) so they sit
// consistently next to the library icons. Kept to simple primitives
// (circles/ellipses/straight lines) rather than freehand illustration -
// symbolic, not literal deity imagery.
function Lotus(props) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="6" rx="2" ry="4" />
      <ellipse cx="12" cy="18" rx="2" ry="4" />
      <ellipse cx="6" cy="12" rx="4" ry="2" />
      <ellipse cx="18" cy="12" rx="4" ry="2" />
    </svg>
  )
}
function Chakra(props) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  )
}
// Replaces the earlier Trident mark (2026-08-20, docs/DESIGN-GUIDE-V1.md) -
// the trident's 4 open, diverging lines read visually lighter than every
// other mark in this file, breaking rhythm in a row of practice icons. A
// single Rudraksha bead (outer circle + its natural "mukhi" facet lines)
// keeps the same closed, grounded silhouette as Lotus/Mace/Sunrise.
function Rudraksha(props) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
    </svg>
  )
}
function JapaMala(props) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" {...props}>
      <circle cx="12" cy="4.3" r="1.2" /><circle cx="17.2" cy="6.2" r="1.2" />
      <circle cx="19.6" cy="11" r="1.2" /><circle cx="17.2" cy="15.8" r="1.2" />
      <circle cx="12" cy="17.7" r="1.2" /><circle cx="6.8" cy="15.8" r="1.2" />
      <circle cx="4.4" cy="11" r="1.2" /><circle cx="6.8" cy="6.2" r="1.2" />
    </svg>
  )
}
function Mace(props) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v10" />
      <path d="M9 21h6" />
    </svg>
  )
}

// Keyed by practices.slug. Falls back to a generic mark for anything not
// listed here (the catalog is admin-extendable without an app update).
export const PRACTICE_ICONS = {
  'sandhyavandhanam': Sunrise,
  'vishnu-sahasranamam': Mace, // gada - one of Vishnu's four hand-held symbols
  'lalitha-sahasranamam': Lotus,
  'hanuman-chalisa': Flag,
  'narayaneeyam': BookOpen,
  'bhagavad-gita': Chakra,
  'aditya-hrudayam': Sun,
  'sri-rudram': Rudraksha,
  'shiva-panchakshari': JapaMala,
  'devi-mahatmyam': Sword,
  'soundarya-lahari': Waves,
  'mukundamala': Music2,
  'subrahmanya-bhujangam': Feather,
  'dakshinamurthy-stotram': TreeDeciduous,
  'bhagavatam': Library,
  'temple-visit': Landmark,
  'ramayanam': Flame,
  'sai-baba-aarti': Lamp,
}

export default function PracticeIcon({ slug, ...props }) {
  const Icon = PRACTICE_ICONS[slug] ?? Sparkles
  return <Icon {...props} />
}
