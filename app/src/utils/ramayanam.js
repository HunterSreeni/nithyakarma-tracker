// Shared kandam list for the Ramayanam reader (RamayanamPage.jsx picker,
// KandamPage.jsx reader). Sarga counts and availability confirmed directly
// against prapatti.com's per-sarga Sanskrit + Malayalam PDFs (Sunder
// Kidambi's edition) - see scripts/download-ramayanam-pdfs.cjs for the
// source URLs. Uttara Kandam isn't published by that source under any name
// tried, so it's left out rather than guessed at.
export const KANDAMS = [
  { slug: 'bala', name: 'Bala Kandam', totalSargas: 77 },
  { slug: 'ayodhya', name: 'Ayodhya Kandam', totalSargas: 119 },
  { slug: 'aranya', name: 'Aranya Kandam', totalSargas: 75 },
  { slug: 'kishkindha', name: 'Kishkindha Kandam', totalSargas: 67 },
  { slug: 'sundara', name: 'Sundara Kandam', totalSargas: 68 },
  { slug: 'yuddha', name: 'Yuddha Kandam', totalSargas: 128 },
]

export function findKandam(slug) {
  return KANDAMS.find((k) => k.slug === slug)
}
