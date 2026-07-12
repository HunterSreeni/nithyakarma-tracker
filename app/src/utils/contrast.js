// WCAG 2.1 relative-luminance contrast ratio between two hex colors (#rgb or
// #rrggbb). Used to lock in accessible color tokens via a unit test.
function luminance(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
  const lin = channels.map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
