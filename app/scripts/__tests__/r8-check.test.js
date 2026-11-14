// Unit tests for scripts/r8-check.mjs (the R8 bridge-survival gate).
import { describe, it, expect } from 'vitest'
import {
  scanSource, stripComments, parseMapping, parseDexdump, obfuscationRatio, checkR8, FIXED_CLASSES,
} from '../r8-check.mjs'

const JAVA_PLUGIN = `
package com.example.share;
import com.getcapacitor.annotation.CapacitorPlugin;
// a comment mentioning class Fake and @CapacitorPlugin
/* block comment: public class AlsoFake { } */
@CapacitorPlugin(name = "Share", permissions = { @Permission(alias = "x", strings = { "a" }) })
public class SharePlugin extends Plugin {
    @PluginMethod
    public void share(PluginCall call) {}
    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    public void canShare(PluginCall call) {}
    public void helper() {}
}`

const KOTLIN_PLUGIN = `
package com.example.fs
@CapacitorPlugin(
    permissions = [Permission(strings = [Manifest.permission.READ], alias = "publicStorage")]
)
class FilesystemPlugin : Plugin() {
    @PluginMethod
    fun readFile(call: PluginCall) {}
    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    override fun writeFile(call: PluginCall) {}
}`

const JS_INTERFACE = `
package com.getcapacitor;
public class MessageHandler {
    @JavascriptInterface
    @SuppressWarnings("unused")
    public void postMessage(String jsonStr) {}
}`

describe('stripComments', () => {
  it('removes line and block comments but keeps URLs in strings', () => {
    const out = stripComments('a // x\n/* y */b "https://z" // q')
    expect(out).toBe('a \nb "https://z" ')
  })
})

describe('scanSource', () => {
  it('reads a Java plugin: name from the annotation, only @PluginMethod methods', () => {
    expect(scanSource(JAVA_PLUGIN)).toEqual({
      cls: 'com.example.share.SharePlugin', isPlugin: true, pluginName: 'Share', methods: ['share', 'canShare'],
    })
  })

  it('reads a Kotlin plugin and falls back to the class name', () => {
    expect(scanSource(KOTLIN_PLUGIN)).toEqual({
      cls: 'com.example.fs.FilesystemPlugin', isPlugin: true, pluginName: 'FilesystemPlugin', methods: ['readFile', 'writeFile'],
    })
  })

  it('keeps @JavascriptInterface methods on non-plugin classes', () => {
    expect(scanSource(JS_INTERFACE)).toEqual({
      cls: 'com.getcapacitor.MessageHandler', isPlugin: false, pluginName: null, methods: ['postMessage'],
    })
  })

  it('treats the base Plugin class as reflective', () => {
    const src = 'package com.getcapacitor;\npublic class Plugin {\n  @PluginMethod\n  public void addListener(PluginCall c) {}\n}'
    expect(scanSource(src).methods).toEqual(['addListener'])
  })

  it('ignores @PluginMethod on helper classes that are not plugins', () => {
    const src = 'package a.b;\nclass AdRewardExecutor {\n  @PluginMethod\n  fun prepare(call: PluginCall) {}\n}'
    expect(scanSource(src)).toBeNull()
  })

  it('ignores a mention of @CapacitorPlugin inside code', () => {
    const src = 'package a;\npublic class Bridge {\n  String s = getAnnotation(CapacitorPlugin.class) + "@CapacitorPlugin";\n}'
    expect(scanSource(src)).toBeNull()
  })

  it('returns null without a package or class', () => {
    expect(scanSource('public class X {}')).toBeNull()
    expect(scanSource('package a;\npublic @interface CapacitorPlugin {}')).toBeNull()
  })
})

const MAPPING = `# compiler: R8
com.example.share.SharePlugin -> com.example.share.SharePlugin:
    1:3:void share(com.getcapacitor.PluginCall):10:12 -> share
    void helper() -> a
    int counter -> b
com.example.Internal -> a.a:
    void run() -> b
com.example.Other -> a.b:
`

describe('parseMapping', () => {
  it('parses class and method renames, ignoring fields and comments', () => {
    const m = parseMapping(MAPPING)
    expect([...m.keys()]).toEqual(['com.example.share.SharePlugin', 'com.example.Internal', 'com.example.Other'])
    expect(m.get('com.example.Internal').renamed).toBe('a.a')
    const share = m.get('com.example.share.SharePlugin')
    expect([...share.methods.get('share')]).toEqual(['share'])
    expect([...share.methods.get('helper')]).toEqual(['a'])
    expect(share.methods.has('counter')).toBe(false)
  })

  it('handles CRLF line endings', () => {
    expect(parseMapping(MAPPING.replace(/\n/g, '\r\n')).size).toBe(3)
  })
})

const DEXDUMP = `Class #0            -
  Class descriptor  : 'Lcom/example/share/SharePlugin;'
  Static fields     -
    #0              : (in Lcom/example/share/SharePlugin;)
      name          : 'TAG'
  Instance fields   -
    #0              : (in Lcom/example/share/SharePlugin;)
      name          : 'shareField'
  Direct methods    -
    #0              : (in Lcom/example/share/SharePlugin;)
      name          : '<init>'
  Virtual methods   -
    #0              : (in Lcom/example/share/SharePlugin;)
      name          : 'share'
Class #1            -
  Class descriptor  : 'La/a;'
  Virtual methods   -
    #0              : (in La/a;)
      name          : 'b'
`

describe('parseDexdump', () => {
  it('collects method names per class and skips fields', () => {
    const d = parseDexdump(DEXDUMP)
    expect([...d.get('com.example.share.SharePlugin')]).toEqual(['<init>', 'share'])
    expect([...d.get('a.a')]).toEqual(['b'])
  })
})

describe('obfuscationRatio', () => {
  it('is the share of renamed classes', () => {
    expect(obfuscationRatio(parseMapping(MAPPING))).toBeCloseTo(2 / 3)
  })
  it('is 0 for an empty mapping', () => {
    expect(obfuscationRatio(new Map())).toBe(0)
  })
})

describe('checkR8', () => {
  const expected = [{ cls: 'com.example.share.SharePlugin', methods: ['share'] }]
  const base = { expected, fixedClasses: [], mapping: parseMapping(MAPPING), dex: parseDexdump(DEXDUMP) }

  it('passes when classes and methods survive with their names', () => {
    expect(checkR8(base)).toEqual({ errors: [], ratio: 2 / 3, checked: 1 })
  })

  it('fails when a bridge class is renamed', () => {
    const mapping = parseMapping(MAPPING.replace('SharePlugin -> com.example.share.SharePlugin:', 'SharePlugin -> a.c:'))
    expect(checkR8({ ...base, mapping }).errors).toContain('class renamed: com.example.share.SharePlugin -> a.c')
  })

  it('fails when a bridge class is missing from the DEX', () => {
    const { errors } = checkR8({ ...base, dex: new Map() })
    expect(errors).toEqual(['class missing from DEX: com.example.share.SharePlugin'])
  })

  it('fails when a bridge method is renamed', () => {
    const mapping = parseMapping(MAPPING.replace(':10:12 -> share', ':10:12 -> z'))
    expect(checkR8({ ...base, mapping }).errors).toContain('method renamed: com.example.share.SharePlugin.share -> z')
  })

  it('fails when a bridge method is missing from the DEX', () => {
    const dex = parseDexdump(DEXDUMP.replace("name          : 'share'", "name          : 'other'"))
    expect(checkR8({ ...base, dex }).errors).toEqual(['method missing from DEX: com.example.share.SharePlugin.share'])
  })

  it('allows a non-plugin bridge class to be renamed but still checks its methods', () => {
    const mapping = parseMapping('com.getcapacitor.MessageHandler -> a.a:\n    void postMessage(java.lang.String) -> postMessage\n')
    const dex = parseDexdump(DEXDUMP.replace("La/a;'", "La/a;'").replace("name          : 'b'", "name          : 'postMessage'"))
    const exp = [{ cls: 'com.getcapacitor.MessageHandler', isPlugin: false, methods: ['postMessage'] }]
    expect(checkR8({ ...base, expected: exp, mapping, dex, minRatio: 0 }).errors).toEqual([])
    const renamedMethod = parseMapping('com.getcapacitor.MessageHandler -> a.a:\n    void postMessage(java.lang.String) -> b\n')
    expect(checkR8({ ...base, expected: exp, mapping: renamedMethod, dex: parseDexdump(DEXDUMP), minRatio: 0 }).errors)
      .toEqual(['method renamed: com.getcapacitor.MessageHandler.postMessage -> b', 'method missing from DEX: com.getcapacitor.MessageHandler.postMessage'])
  })

  it('reports a renamed non-plugin class missing under its new name', () => {
    const mapping = parseMapping('com.getcapacitor.Plugin -> z.z:\n')
    const exp = [{ cls: 'com.getcapacitor.Plugin', isPlugin: false, methods: [] }]
    expect(checkR8({ ...base, expected: exp, mapping, minRatio: 0 }).errors).toEqual(['class missing from DEX: com.getcapacitor.Plugin (as z.z)'])
  })

  it('still requires plugin classes to keep their name', () => {
    const mapping = parseMapping(MAPPING.replace('SharePlugin -> com.example.share.SharePlugin:', 'SharePlugin -> a.c:'))
    const exp = [{ cls: 'com.example.share.SharePlugin', isPlugin: true, methods: [] }]
    expect(checkR8({ ...base, expected: exp, mapping }).errors).toContain('class renamed: com.example.share.SharePlugin -> a.c')
  })

  it('checks the fixed manifest classes', () => {
    const { errors, checked } = checkR8({ ...base, fixedClasses: ['org.x.MainActivity'] })
    expect(checked).toBe(2)
    expect(errors).toEqual(['class missing from DEX: org.x.MainActivity'])
  })

  it('fails when obfuscation is below the threshold', () => {
    const { errors } = checkR8({ ...base, minRatio: 0.9 })
    expect(errors).toEqual(['obfuscation 66.7% is below 90%'])
  })

  it('passes exactly at the threshold', () => {
    expect(checkR8({ ...base, minRatio: 2 / 3 }).errors).toEqual([])
  })

  it('defaults to the real manifest classes', () => {
    expect(FIXED_CLASSES).toContain('org.nithyakarma.app.MainActivity')
    expect(checkR8({ ...base, fixedClasses: undefined }).checked).toBe(1 + FIXED_CLASSES.length)
  })
})
