// Fetches the pinned Qwen3.5-2B GGUF into <repo>/models. Setup-time network only; the app never downloads.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Pinned from https://huggingface.co/api/models/unsloth/Qwen3.5-2B-GGUF/tree/main (lfs.oid, lfs.size) on 2026-10-09.
const FILE = 'Qwen3.5-2B-Q4_K_M.gguf'
const SHA256 = 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223'
const SIZE = 1280835840
const MODEL_URL = `https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/${FILE}`

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'models')
const dest = path.join(dir, FILE)
const part = dest + '.part'

async function sha256(file) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

if (existsSync(dest) && (await sha256(dest)) === SHA256) {
  console.error(`model ok: ${dest}`)
  process.exit(0)
}

mkdirSync(dir, { recursive: true })
rmSync(dest, { force: true })
console.error(`downloading ${MODEL_URL}`)
const res = await fetch(MODEL_URL)
if (!res.ok) {
  console.error(`download failed: HTTP ${res.status}`)
  process.exit(1)
}

const total = Number(res.headers.get('content-length')) || SIZE
const hash = createHash('sha256')
let done = 0
let lastPct = -1
const meter = new Transform({
  transform(chunk, _enc, cb) {
    hash.update(chunk)
    done += chunk.length
    const pct = Math.floor((done / total) * 100)
    if (pct !== lastPct) {
      lastPct = pct
      process.stderr.write(`\r${pct}% ${(done / 1e6).toFixed(0)}/${(total / 1e6).toFixed(0)} MB`)
    }
    cb(null, chunk)
  },
})

try {
  await pipeline(Readable.fromWeb(res.body), meter, createWriteStream(part))
} catch (err) {
  rmSync(part, { force: true })
  console.error(`\ndownload failed: ${err.message}`)
  process.exit(1)
}
process.stderr.write('\n')

const got = hash.digest('hex')
if (got !== SHA256) {
  rmSync(part, { force: true })
  console.error(`sha256 mismatch: expected ${SHA256}, got ${got}; partial file deleted`)
  process.exit(1)
}
renameSync(part, dest)
console.error(`model ok: ${dest}`)
