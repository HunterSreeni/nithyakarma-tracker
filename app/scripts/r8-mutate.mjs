// Applies one R8 config mutant so the mutation workflow can prove r8-verify.sh
// catches it. Each mutant must change exactly what it claims (asserted here, and
// again against R8's configuration.txt after the build via --assert).
//   node scripts/r8-mutate.mjs <id>            apply mutant (run from app/)
//   node scripts/r8-mutate.mjs <id> --assert   check R8 really saw the mutation
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const GRADLE = 'android/app/build.gradle'
const RULES = 'android/app/proguard-rules.pro'
const CAP_RULES = 'node_modules/@capacitor/android/capacitor/proguard-rules.pro'
const CONFIG = 'android/app/build/outputs/mapping/release/configuration.txt'
const MUTANT_DEFAULT = 'android/app/r8-mutant-default.pro'

function replaceOnce(file, from, to) {
  const text = readFileSync(file, 'utf8')
  const count = text.split(from).length - 1
  if (count !== 1) throw new Error(`${file}: expected exactly 1 match for ${JSON.stringify(from)}, found ${count}`)
  writeFileSync(file, text.replace(from, to))
}

function agpDefault() {
  const dir = 'android/app/build/intermediates/default_proguard_files/global'
  const name = existsSync(dir) && readdirSync(dir).find(n => n.startsWith('proguard-android.txt'))
  if (!name) throw new Error(`run ./gradlew :app:extractProguardFiles first (${dir} missing)`)
  return readFileSync(join(dir, name), 'utf8')
}

export const MUTANTS = {
  // Capacitor's consumer rules are the only thing keeping plugin classes/methods.
  'drop-capacitor-plugin-keeps': {
    apply() {
      const text = readFileSync(CAP_RULES, 'utf8')
      const out = text.replace(/-keep @com\.getcapacitor\.annotation\.CapacitorPlugin[\s\S]*?\n\s*}\n/, '')
        .replace(/-keep public class \* extends com\.getcapacitor\.Plugin \{ \*; \}\n/, '')
        .replace(/-keep @com\.getcapacitor\.NativePlugin[\s\S]*?\n\s*}\n/, '')
      if (out === text || /getcapacitor\.(Plugin|annotation\.CapacitorPlugin|NativePlugin)/.test(out)) throw new Error('capacitor keep rules not removed')
      writeFileSync(CAP_RULES, out)
    },
    assert: config => !/extends com\.getcapacitor\.Plugin/.test(config) && !/annotation\.CapacitorPlugin/.test(config),
  },
  // AGP's default file keeps @JavascriptInterface methods for the WebView bridge.
  'drop-js-interface-keep': {
    apply() {
      const out = agpDefault().replace(/-keepclassmembers class \* \{\s*@android\.webkit\.JavascriptInterface <methods>;\s*}\n?/, '')
      if (/JavascriptInterface/.test(out)) throw new Error('JavascriptInterface rule not removed from AGP default')
      writeFileSync(MUTANT_DEFAULT, out)
      replaceOnce(GRADLE, "getDefaultProguardFile('proguard-android.txt')", "'r8-mutant-default.pro'")
    },
    assert: config => !/^-keepclassmembers class \* \{\s*@android\.webkit\.JavascriptInterface/m.test(config),
  },
  'minify-off': {
    apply: () => replaceOnce(GRADLE, 'minifyEnabled true', 'minifyEnabled false'),
    assert: () => !existsSync(CONFIG),
  },
  'dontobfuscate': {
    apply: () => writeFileSync(RULES, readFileSync(RULES, 'utf8') + '\n-dontobfuscate\n'),
    assert: config => /^-dontobfuscate/m.test(config),
  },
}

const [id, flag] = process.argv.slice(2)
if (id) {
  const mutant = MUTANTS[id]
  if (!mutant) { console.error(`unknown mutant ${id}; known: ${Object.keys(MUTANTS).join(', ')}`); process.exit(2) }
  if (flag === '--assert') {
    const ok = mutant.assert(existsSync(CONFIG) ? readFileSync(CONFIG, 'utf8') : '')
    console.log(`${id}: mutation ${ok ? 'confirmed' : 'NOT visible'} in R8 configuration`)
    process.exit(ok ? 0 : 1)
  }
  mutant.apply()
  console.log(`${id}: applied`)
}
