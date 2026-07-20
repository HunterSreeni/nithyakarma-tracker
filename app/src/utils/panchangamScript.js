// Native-script names for the panchangam box, keyed by the transliterated
// values generate-panchangam.cjs stores. Purely a display lookup - no schema
// change.
export const TAMIL_MONTH_SCRIPT = {
  Chithirai: 'சித்திரை', Vaikasi: 'வைகாசி', Aani: 'ஆனி', Aadi: 'ஆடி',
  Aavani: 'ஆவணி', Purattasi: 'புரட்டாசி', Aippasi: 'ஐப்பசி', Karthikai: 'கார்த்திகை',
  Margazhi: 'மார்கழி', Thai: 'தை', Maasi: 'மாசி', Panguni: 'பங்குனி',
}

// The 60-year samvatsara cycle in Tamil, keyed by the transliteration
// generate-panchangam.cjs stores. Kerala does not name years from this cycle -
// it numbers them (see kollavarshamLabel below) - so there is no Malayalam twin.
export const TAMIL_SAMVATSARA_SCRIPT = {
  Prabhava: 'பிரபவ', Vibhava: 'விபவ', Shukla: 'சுக்ல', Pramoduta: 'பிரமோதூத',
  Prajapati: 'பிரசோற்பத்தி', Angirasa: 'ஆங்கீரச', Shrimukha: 'ஸ்ரீமுக', Bhava: 'பவ',
  Yuva: 'யுவ', Dhatu: 'தாது', Ishvara: 'ஈஸ்வர', Bahudhanya: 'வெகுதானிய',
  Pramathi: 'பிரமாதி', Vikrama: 'விக்கிரம', Vrisha: 'விஷு', Chitrabhanu: 'சித்திரபானு',
  Subhanu: 'சுபானு', Tarana: 'தாரண', Parthiva: 'பார்த்திப', Vyaya: 'விய',
  Sarvajit: 'சர்வசித்து', Sarvadhari: 'சர்வதாரி', Virodhi: 'விரோதி', Vikriti: 'விக்ருதி',
  Khara: 'கர', Nandana: 'நந்தன', Vijaya: 'விஜய', Jaya: 'ஜய',
  Manmatha: 'மன்மத', Durmukhi: 'துன்முகி', Hevilambi: 'ஹேவிளம்பி', Vilambi: 'விளம்பி',
  Vikari: 'விகாரி', Sharvari: 'சார்வரி', Plava: 'பிலவ', Shubhakrit: 'சுபகிருது',
  Shobhakrit: 'சோபகிருது', Krodhi: 'குரோதி', Vishvavasu: 'விசுவாவசு', Parabhava: 'பராபவ',
  Plavanga: 'பிலவங்க', Kilaka: 'கீலக', Saumya: 'சௌமிய', Sadharana: 'சாதாரண',
  Virodhikrit: 'விரோதிகிருது', Paridhavi: 'பரிதாபி', Pramadi: 'பிரமாதீச', Ananda: 'ஆனந்த',
  Rakshasa: 'ராட்சச', Nala: 'நள', Pingala: 'பிங்கள', Kalayukti: 'காளயுக்தி',
  Siddharthi: 'சித்தார்த்தி', Raudra: 'ரௌத்திரி', Durmati: 'துன்மதி', Dundubhi: 'துந்துபி',
  Rudhirodgari: 'ருத்ரோத்காரி', Raktakshi: 'ரக்தாட்சி', Krodhana: 'குரோதன', Akshaya: 'அட்சய',
}

export const MALAYALAM_MONTH_SCRIPT = {
  Medam: 'മേടം', Edavam: 'ഇടവം', Mithunam: 'മിഥുനം', Karkidakam: 'കർക്കടകം',
  Chingam: 'ചിങ്ങം', Kanni: 'കന്നി', Thulam: 'തുലാം', Vrischikam: 'വൃശ്ചികം',
  Dhanu: 'ധനു', Makaram: 'മകരം', Kumbham: 'കുംഭം', Meenam: 'മീനം',
}

// Kerala does not transliterate the Sanskrit nakshatra names - it uses its own
// traditional set (Ardra is Thiruvathira, Shravana is Thiruvonam, and so on).
// Keying off the Sanskrit name the generator stores keeps the schema unchanged.
export const MALAYALAM_NAKSHATRA_SCRIPT = {
  Ashwini: 'അശ്വതി', Bharani: 'ഭരണി', Krittika: 'കാർത്തിക', Rohini: 'രോഹിണി',
  Mrigashira: 'മകയിരം', Ardra: 'തിരുവാതിര', Punarvasu: 'പുണർതം', Pushya: 'പൂയം',
  Ashlesha: 'ആയില്യം', Magha: 'മകം', 'Purva Phalguni': 'പൂരം', 'Uttara Phalguni': 'ഉത്രം',
  Hasta: 'അത്തം', Chitra: 'ചിത്തിര', Swati: 'ചോതി', Vishakha: 'വിശാഖം',
  Anuradha: 'അനിഴം', Jyeshtha: 'തൃക്കേട്ട', Mula: 'മൂലം', 'Purva Ashadha': 'പൂരാടം',
  'Uttara Ashadha': 'ഉത്രാടം', Shravana: 'തിരുവോണം', Dhanishta: 'അവിട്ടം',
  Shatabhisha: 'ചതയം', 'Purva Bhadrapada': 'പൂരുരുട്ടാതി', 'Uttara Bhadrapada': 'ഉത്രട്ടാതി',
  Revati: 'രേവതി',
}

// Tamil Nadu, like Kerala, uses its own traditional nakshatra set rather than
// transliterating the Sanskrit (Jyeshtha is Kettai, Ardra is Thiruvathirai).
// Keyed off the Sanskrit name the generator stores, as the Malayalam table is.
export const TAMIL_NAKSHATRA_SCRIPT = {
  Ashwini: 'அசுவினி', Bharani: 'பரணி', Krittika: 'கிருத்திகை', Rohini: 'ரோகிணி',
  Mrigashira: 'மிருகசீரிடம்', Ardra: 'திருவாதிரை', Punarvasu: 'புனர்பூசம்', Pushya: 'பூசம்',
  Ashlesha: 'ஆயில்யம்', Magha: 'மகம்', 'Purva Phalguni': 'பூரம்', 'Uttara Phalguni': 'உத்திரம்',
  Hasta: 'அஸ்தம்', Chitra: 'சித்திரை', Swati: 'சுவாதி', Vishakha: 'விசாகம்',
  Anuradha: 'அனுஷம்', Jyeshtha: 'கேட்டை', Mula: 'மூலம்', 'Purva Ashadha': 'பூராடம்',
  'Uttara Ashadha': 'உத்திராடம்', Shravana: 'திருவோணம்', Dhanishta: 'அவிட்டம்',
  Shatabhisha: 'சதயம்', 'Purva Bhadrapada': 'பூரட்டாதி', 'Uttara Bhadrapada': 'உத்திரட்டாதி',
  Revati: 'ரேவதி',
}

const TAMIL_TITHI_SCRIPT = {
  Pratipada: 'பிரதமை', Dwitiya: 'துவிதியை', Tritiya: 'திருதியை', Chaturthi: 'சதுர்த்தி',
  Panchami: 'பஞ்சமி', Shashthi: 'சஷ்டி', Saptami: 'சப்தமி', Ashtami: 'அஷ்டமி',
  Navami: 'நவமி', Dashami: 'தசமி', Ekadashi: 'ஏகாதசி', Dwadashi: 'துவாதசி',
  Trayodashi: 'திரயோதசி', Chaturdashi: 'சதுர்த்தசி',
  Purnima: 'பௌர்ணமி', Amavasya: 'அமாவாசை',
}

// Tamil calendars name the fortnights by the moon's direction rather than
// transliterating shukla/krishna: waxing is valarpirai, waning is theypirai.
const TAMIL_PAKSHA_SCRIPT = { Shukla: 'வளர்பிறை', Krishna: 'தேய்பிறை' }

export const TAMIL_KALAM_SCRIPT = {
  rahu: 'ராகு காலம்',
  yamagandam: 'எமகண்டம்',
  gulika: 'குளிகை காலம்',
}

const MALAYALAM_TITHI_SCRIPT = {
  Pratipada: 'പ്രഥമ', Dwitiya: 'ദ്വിതീയ', Tritiya: 'തൃതീയ', Chaturthi: 'ചതുർത്ഥി',
  Panchami: 'പഞ്ചമി', Shashthi: 'ഷഷ്ഠി', Saptami: 'സപ്തമി', Ashtami: 'അഷ്ടമി',
  Navami: 'നവമി', Dashami: 'ദശമി', Ekadashi: 'ഏകാദശി', Dwadashi: 'ദ്വാദശി',
  Trayodashi: 'ത്രയോദശി', Chaturdashi: 'ചതുർദശി',
  Purnima: 'പൗർണ്ണമി', Amavasya: 'അമാവാസി',
}

const MALAYALAM_PAKSHA_SCRIPT = { Shukla: 'ശുക്ലപക്ഷം', Krishna: 'കൃഷ്ണപക്ഷം' }

export const MALAYALAM_KALAM_SCRIPT = {
  rahu: 'രാഹുകാലം',
  yamagandam: 'യമകണ്ടകം',
  gulika: 'ഗുളികകാലം',
}

// The generator stores either a bare 'Purnima'/'Amavasya' or a composite
// '<Paksha> <Tithi>'. Returns null when either half is unmapped, so callers
// can fall back to the stored transliteration rather than render a partial.
function scriptThithi(thithi, tithiTable, pakshaTable) {
  if (!thithi) return null
  if (tithiTable[thithi]) return tithiTable[thithi]
  const [paksha, ...rest] = thithi.split(' ')
  const name = tithiTable[rest.join(' ')]
  const pakshaScript = pakshaTable[paksha]
  return name && pakshaScript ? `${pakshaScript} ${name}` : null
}

export function malayalamThithi(thithi) {
  return scriptThithi(thithi, MALAYALAM_TITHI_SCRIPT, MALAYALAM_PAKSHA_SCRIPT)
}

export function tamilThithi(thithi) {
  return scriptThithi(thithi, TAMIL_TITHI_SCRIPT, TAMIL_PAKSHA_SCRIPT)
}

// Kerala does not use the 60-name samvatsara cycle for the year - it counts the
// Kollavarsham (Malayalam Era) and rolls over at Chingam 1, a different boundary
// from the samvatsara's Mesha Sankranti. So "Parabhava" is simply not the
// Malayalam year name; ME 1201 is. Returns null when the column is absent (rows
// generated before the kollavarsham_year migration) so callers can omit it.
export function kollavarshamLabel(year) {
  return year == null ? null : `കൊല്ലവർഷം ${year}`
}
