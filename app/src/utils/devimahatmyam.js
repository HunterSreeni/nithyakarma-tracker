// Chapter list for the Devi Mahatmyam reader (DeviMahatmyamPage.jsx).
// The 13 adhyayas group into three charitas (per the traditional Durga
// Saptashati structure) - grouping shown as a heading in the chapter picker,
// not a separate route level like Ramayanam's kandams, since 13 chapters
// fits comfortably in one dropdown.
export const CHAPTERS = [
  { number: 1, charita: 'Prathama Charita' },
  { number: 2, charita: 'Madhyama Charita' },
  { number: 3, charita: 'Madhyama Charita' },
  { number: 4, charita: 'Madhyama Charita' },
  { number: 5, charita: 'Uttama Charita' },
  { number: 6, charita: 'Uttama Charita' },
  { number: 7, charita: 'Uttama Charita' },
  { number: 8, charita: 'Uttama Charita' },
  { number: 9, charita: 'Uttama Charita' },
  { number: 10, charita: 'Uttama Charita' },
  { number: 11, charita: 'Uttama Charita' },
  { number: 12, charita: 'Uttama Charita' },
  { number: 13, charita: 'Uttama Charita' },
]

export const TOTAL_CHAPTERS = CHAPTERS.length

export function findChapter(number) {
  return CHAPTERS.find((c) => c.number === Number(number))
}
