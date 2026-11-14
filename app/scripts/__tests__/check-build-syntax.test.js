// Unit tests for scripts/check-build-syntax.mjs (old-WebView syntax guard).
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanSource, scanDir } from '../check-build-syntax.mjs'

describe('scanSource', () => {
  it('flags class static blocks in minified and readable form', () => {
    expect(scanSource('class A{static{this.x=1}}')).toEqual([{ name: 'class static block (Chrome 94+)', count: 1 }])
    expect(scanSource('class A {\n  static {\n  }\n}')).toEqual([{ name: 'class static block (Chrome 94+)', count: 1 }])
  })
  it('flags private brand checks', () => {
    expect(scanSource('class A{#p;static is(o){return #p in o}}')).toEqual([{ name: 'private brand check `#x in obj` (Chrome 91+)', count: 1 }])
  })
  it('allows syntax Chrome 90 supports', () => {
    expect(scanSource('class A{static x=1;#y=2;static m(){return this?.x??0}}')).toEqual([])
    expect(scanSource('const staticValue={};const s=staticValue')).toEqual([])
  })
})

describe('scanDir', () => {
  it('scans .js and .mjs files only and names the offender', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nk-syntax-'))
    writeFileSync(join(dir, 'ok.js'), 'const a=1')
    writeFileSync(join(dir, 'worker.mjs'), 'class W{static{}}')
    writeFileSync(join(dir, 'style.css'), '.static{color:red}')
    expect(scanDir(dir)).toEqual([{ file: 'worker.mjs', name: 'class static block (Chrome 94+)', count: 1 }])
  })
})
