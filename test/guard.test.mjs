import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { evaluateShellCommand } from '../guard/policy.mjs'
import { createPreExecuteHook } from '../guard/hook.mjs'

const cfg = {
  allowShell: false,
  defaultSaveDir: 'C:\\Users\\test\\Downloads',
  toolPrefix: 'conductor_',
}

const deny = (command) => {
  const decision = evaluateShellCommand(command, { cfg })
  assert.equal(decision.kind, 'deny', command)
  assert.match(decision.reason, /conductor_download/)
  assert.match(decision.reason, /DSH_DOWNLOAD_ALLOW_SHELL=1/)
  return decision
}

const allow = (command) => {
  assert.equal(evaluateShellCommand(command, { cfg }).kind, 'allow', command)
}

test('blocks curl file writers but keeps probes read-only', () => {
  deny('curl -o out.bin https://example.com/a.bin')
  deny('curl -O https://example.com/a.bin')
  deny('curl --output=out.bin https://example.com/a.bin')
  deny('curl -s https://example.com/a.bin > out.bin')
  deny('curl -s https://example.com/a.bin >> out.bin')
  allow('curl -I https://example.com/a.bin')
  allow('curl --spider https://example.com/a.bin')
  allow('curl -s https://example.com/a.bin')
  allow('curl -s https://example.com/a.bin > /dev/null')
  allow('curl -o - https://example.com/a.bin')
})

test('blocks wget file writers, including the default write', () => {
  deny('wget -O out.bin https://example.com/a.bin')
  deny('wget https://example.com/a.bin')
  deny('wget -O out.bin https://example.com/a.bin')
  allow('wget --spider https://example.com/a.bin')
  allow('wget -O - https://example.com/a.bin')
  allow('wget -qO- https://example.com/a.bin')
})

test('blocks PowerShell writers and dedicated downloaders', () => {
  deny('iwr https://example.com/a.bin -OutFile out.bin')
  deny('Invoke-WebRequest https://example.com/a.bin -OutFile out.bin')
  deny('Invoke-RestMethod https://example.com/a.bin -OutFile out.bin')
  deny('Start-BitsTransfer https://example.com/a.bin out.bin')
  deny('aria2c https://example.com/a.bin')
  deny('yt-dlp https://www.bilibili.com/video/BV1xx')
  deny('hf download owner/model --local-dir .')
})

test('allows read-only yt-dlp and aria2c probes', () => {
  allow('yt-dlp --skip-download --print "%(title)s" https://www.bilibili.com/video/BV1xx')
  allow('yt-dlp --simulate https://www.bilibili.com/video/BV1xx')
  allow('yt-dlp --version')
  allow('aria2c --version')
  deny('yt-dlp --skip-download --write-subs https://www.bilibili.com/video/BV1xx')
})

test('the deny hint names the real URL, not the proxy URL', () => {
  const decision = deny('yt-dlp --proxy http://127.0.0.1:7890 https://www.bilibili.com/video/BV1xx')
  assert.match(decision.reason, /bilibili\.com/)
  assert.equal(decision.reason.includes('url="http://127.0.0.1:7890'), false)
})

test('blocks inline scripts that download and write', () => {
  deny('python -c "import requests; open(\'a.bin\',\'wb\').write(requests.get(\'https://example.com\').content)"')
  deny('node -e "fetch(\'https://example.com\').then(r=>r.arrayBuffer()).then(b=>require(\'fs\').writeFileSync(\'a\',Buffer.from(b)))"')
  allow('python -c "print(1)"')
  allow('node -e "console.log(1)"')
})

test('allows ordinary shell commands and the explicit escape hatch', () => {
  allow('echo hello')
  allow('ls -la')
  allow('git status')
  const open = { ...cfg, allowShell: true }
  assert.equal(evaluateShellCommand('curl -o out.bin https://example.com', { cfg: open }).kind, 'allow')
})

test('blocks the audit bypass forms', () => {
  for (const command of [
    'curl -o/tmp/x https://example.com/a',
    'curl -so/tmp/x https://example.com/a',
    'powershell -Command "iwr https://example.com/a -OutFile x"',
    'certutil -urlcache -split -f https://example.com/a x',
    'bitsadmin /transfer job https://example.com/a x',
    'aria2c.exe https://example.com/a',
    'yt-dlp.exe https://www.bilibili.com/video/BV1xx',
    'hf.exe download owner/model --local-dir .',
    'python.exe -c "import urllib.request; open(\'x\',\'wb\').write(urllib.request.urlopen(\'https://example.com\').read())"',
    'node.exe -e "fetch(\'https://example.com\').then(r=>r.arrayBuffer()).then(b=>require(\'fs\').writeFileSync(\'x\',Buffer.from(b)))"',
  ]) {
    deny(command)
  }
  allow('curl -o - https://example.com/a')
  allow('curl --spider https://example.com/a')
})

test('pre-execute hook evaluates script_path inside the allowed roots', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-guard-'))
  const localCfg = { ...cfg, cwd: dir, allowedRoots: [dir], guardFailClosed: true }
  const hook = createPreExecuteHook({ cfg: localCfg })
  const next = () => ({ kind: 'allow' })
  const script = path.join(dir, 'dl.sh')
  fs.writeFileSync(script, 'curl -o out.bin https://example.com/a.bin\n')
  const denied = hook({ name: 'bash', arguments: { script_path: script } }, next)
  assert.equal(denied.kind, 'deny')

  const outside = path.join(os.tmpdir(), 'outside-conductor.sh')
  fs.writeFileSync(outside, 'echo nope\n')
  const outsideDenied = hook({ name: 'bash', arguments: { script_path: outside } }, next)
  assert.equal(outsideDenied.kind, 'deny')
  fs.rmSync(outside, { force: true })

  const big = path.join(dir, 'big.sh')
  fs.writeFileSync(big, 'x'.repeat(1024 * 1024 + 1))
  assert.equal(hook({ name: 'bash', arguments: { script_path: big } }, next).kind, 'deny')
})

test('pre-execute hook only inspects shell tools and fails open', () => {
  const hook = createPreExecuteHook({ cfg })
  let passed = false
  const next = () => {
    passed = true
    return { kind: 'allow' }
  }
  hook({ name: 'read', arguments: {} }, next)
  assert.equal(passed, true)

  const decision = hook({ name: 'bash', arguments: { command: 'curl -o x https://example.com' } }, next)
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.info.kind, 'shell-download')

  const broken = { get name() { throw new Error('boom') } }
  assert.doesNotThrow(() => hook(broken, next))
})
