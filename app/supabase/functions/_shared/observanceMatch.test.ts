// Run with: deno test supabase/functions/_shared/observanceMatch.test.ts
// (no Deno runtime available in this dev environment - logic was sanity
// checked against an equivalent plain-JS port before writing this file;
// run this for real before the first production deploy of Phase 3).
import { assertEquals } from "jsr:@std/assert@1"
import { bestMatch, type ObservanceRule, type PanchangamRow } from "./observanceMatch.ts"

const rules: ObservanceRule[] = [
  {
    key: "monthly_amavasya", category: "tharpanam", title: "t", message: "m",
    match_thithi: "Amavasya", match_tamil_month: null, match_tamil_day: null,
    match_malayalam_month: null, match_malayalam_day: null, match_nakshatra: null,
    day_offset: 0, priority: 0,
  },
  {
    key: "karkidaka_vaavu", category: "tharpanam", title: "t", message: "m",
    match_thithi: "Amavasya", match_tamil_month: null, match_tamil_day: null,
    match_malayalam_month: "Karkidakam", match_malayalam_day: null, match_nakshatra: null,
    day_offset: 0, priority: 10,
  },
  {
    key: "makara_sankranti_tharpanam", category: "tharpanam", title: "t", message: "m",
    match_thithi: null, match_tamil_month: "Thai", match_tamil_day: 1,
    match_malayalam_month: null, match_malayalam_day: null, match_nakshatra: null,
    day_offset: 0, priority: 5,
  },
  {
    key: "onam_thiruvonam", category: "observance", title: "t", message: "m",
    match_thithi: null, match_tamil_month: null, match_tamil_day: null,
    match_malayalam_month: "Chingam", match_malayalam_day: null, match_nakshatra: "Shravana",
    day_offset: 0, priority: 0,
  },
  {
    key: "maha_sivarathri_makaram", category: "observance", title: "t", message: "m",
    match_thithi: "Krishna Chaturdashi", match_tamil_month: null, match_tamil_day: null,
    match_malayalam_month: "Makaram", match_malayalam_day: null, match_nakshatra: null,
    day_offset: 1, priority: 0,
  },
  {
    key: "naraka_chaturdashi", category: "observance", title: "t", message: "m",
    match_thithi: "Krishna Chaturdashi", match_tamil_month: "Aippasi", match_tamil_day: null,
    match_malayalam_month: null, match_malayalam_day: null, match_nakshatra: null,
    day_offset: -1, priority: 0,
  },
]

const row = (overrides: Partial<PanchangamRow>): PanchangamRow => ({
  thithi: "Shukla Panchami", tamil_month: "Thai", tamil_day: 5,
  malayalam_month: "Makaram", malayalam_day: 5, nakshatra: "Ashwini",
  ...overrides,
})

Deno.test("exact thithi match (monthly Amavasya)", () => {
  const match = bestMatch({ 0: row({ thithi: "Amavasya", tamil_month: "Aippasi", malayalam_month: "Thulam" }) }, rules, "tharpanam")
  assertEquals(match?.key, "monthly_amavasya")
})

Deno.test("month+day sankranti match (Makara Sankranti)", () => {
  const match = bestMatch({ 0: row({ tamil_month: "Thai", tamil_day: 1 }) }, rules, "tharpanam")
  assertEquals(match?.key, "makara_sankranti_tharpanam")
})

Deno.test("priority tiebreak: Karkidaka Vaavu beats generic Amavasya on the same date", () => {
  const match = bestMatch({ 0: row({ thithi: "Amavasya", tamil_month: "Aadi", malayalam_month: "Karkidakam" }) }, rules, "tharpanam")
  assertEquals(match?.key, "karkidaka_vaavu")
})

Deno.test("nakshatra+month match (Onam / Thiruvonam)", () => {
  const match = bestMatch({ 0: row({ malayalam_month: "Chingam", nakshatra: "Shravana" }) }, rules, "observance")
  assertEquals(match?.key, "onam_thiruvonam")
})

Deno.test("day_offset match (Maha Sivarathri fires on the Trayodashi day, not the Chaturdashi day)", () => {
  const trayodashiDay = row({ thithi: "Krishna Trayodashi", tamil_month: "Thai", tamil_day: 21, malayalam_month: "Makaram", malayalam_day: 21 })
  const chaturdashiDayAhead = row({ thithi: "Krishna Chaturdashi", tamil_month: "Thai", tamil_day: 22, malayalam_month: "Makaram", malayalam_day: 22 })
  const match = bestMatch({ 0: trayodashiDay, 1: chaturdashiDayAhead }, rules, "observance")
  assertEquals(match?.key, "maha_sivarathri_makaram")
})

Deno.test("negative day_offset match (Naraka Chaturdashi fires on the day AFTER the noon-sampled Chaturdashi day)", () => {
  const chaturdashiDayBefore = row({ thithi: "Krishna Chaturdashi", tamil_month: "Aippasi", tamil_day: 21, malayalam_month: "Thulam", malayalam_day: 21 })
  const amavasyaDay = row({ thithi: "Amavasya", tamil_month: "Aippasi", tamil_day: 22, malayalam_month: "Thulam", malayalam_day: 22 })
  const match = bestMatch({ [-1]: chaturdashiDayBefore, 0: amavasyaDay }, rules, "observance")
  assertEquals(match?.key, "naraka_chaturdashi")
})

Deno.test("no match returns null", () => {
  const match = bestMatch({ 0: row({}) }, rules, "tharpanam")
  assertEquals(match, null)
})

Deno.test("tharpanam and observance categories never cross-match", () => {
  const amavasyaRow = row({ thithi: "Amavasya" })
  assertEquals(bestMatch({ 0: amavasyaRow }, rules, "observance"), null)
  const onamRow = row({ malayalam_month: "Chingam", nakshatra: "Shravana" })
  assertEquals(bestMatch({ 0: onamRow }, rules, "tharpanam"), null)
})

Deno.test("missing row for a rule's day_offset never matches", () => {
  const match = bestMatch({ 0: row({ thithi: "Krishna Trayodashi" }) }, rules, "observance")
  assertEquals(match, null)
})
