// Ledger smoke spike (map ticket O1/O2/O3): capture + model on one machine. No windows, no network.
import { app, powerMonitor } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import xwin from '@miniben90/x-win'
import { getLlama, getLlamaGpuTypes, InsufficientMemoryError, LlamaChatSession } from 'node-llama-cpp'

const MODEL_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'models', 'Qwen3.5-2B-Q4_K_M.gguf')
const POLL_TICKS = 30
const HANDS_OFF_AT = 15
const BUDGET_MS = 10_000
const INTENTION = 'finish the Acme client pitch deck'
// The four probe windows from idea.md §3.
const PROBES = [
  { app: 'Google Chrome', title: 'Instagram — Reels', url: null },
  { app: 'Keynote', title: 'Acme pitch v3.key', url: null },
  { app: 'Google Chrome', title: 'Meta Business Suite — Schedule posts for Acme', url: null },
  { app: 'Slack', title: '#random', url: null },
]
const LABELS = ['serves', 'drifts', 'unclear']
const S2_SYSTEM =
  'You label one desktop window against the stated intention of a work session. ' +
  'Answer with label serves, drifts, or unclear, and a reason under 140 characters. ' +
  'Never repeat the window title or the URL in the reason.'

const log = (o) => console.log(JSON.stringify(o))

// Without windows Electron never emits this; registered so a stray window cannot quit the run early.
app.on('window-all-closed', () => {})

app.whenReady().then(run).then(
  () => app.quit(),
  (err) => {
    console.error(err)
    app.exit(1)
  },
)

async function run() {
  log({ platform: process.platform, arch: process.arch, totalmemGB: +(os.totalmem() / 2 ** 30).toFixed(1), cpu: os.cpus()[0].model })
  await poll()
  await judge(await loadRuntime())
}

function poll() {
  console.log(`>>> For ${POLL_TICKS} s: switch between Chrome (on a web page), VS Code, and Explorer/Finder/file manager. At "HANDS OFF", stop touching mouse and keyboard until the poll ends.`)
  const t0 = Date.now()
  let key = null
  let url = ''
  let tick = 0
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      tick++
      const t = Math.round((Date.now() - t0) / 1000)
      const idle = powerMonitor.getSystemIdleTime()
      const idleState = powerMonitor.getSystemIdleState(120)
      try {
        const s = performance.now()
        const w = xwin.activeWindow()
        const { execName, name, processId } = w.info
        const k = `${execName}\u0000${w.title}`
        if (k !== key) {
          key = k
          try {
            url = w.url
          } catch (err) {
            url = `<url error: ${err.message}>`
          }
        }
        log({ t, execName, name, title: w.title, url, idle, idleState, own: processId === process.pid, xwinMs: Math.round(performance.now() - s) })
      } catch (err) {
        log({ t, error: String(err), idle, idleState })
      }
      if (tick === HANDS_OFF_AT) console.log('>>> HANDS OFF now, until the poll ends.')
      if (tick >= POLL_TICKS) {
        clearInterval(timer)
        resolve()
      }
    }, 1000)
  })
}

async function loadRuntime() {
  try {
    return await initModel('auto')
  } catch (err) {
    if (!(err instanceof InsufficientMemoryError)) throw err
    log({ gpuFallback: `InsufficientMemoryError: ${err.message}; retrying with gpu:false` })
    return initModel(false)
  }
}

async function initModel(gpu) {
  const llama = await getLlama({ gpu, build: 'never' })
  try {
    const s = performance.now()
    const model = await llama.loadModel({ modelPath: MODEL_PATH })
    const loadMs = Math.round(performance.now() - s)
    const decision = await model.createDecisionContext({ contextSize: { max: 1024 } })
    const chat = await model.createContext({ contextSize: 2048 })
    const grammar = await llama.createGrammarForJsonSchema({
      type: 'object',
      properties: { label: { enum: LABELS }, reason: { type: 'string', maxLength: 140 } },
    })
    const cpuReason = llama.gpu === false
      ? gpu === false ? 'gpu:false after InsufficientMemoryError' : `no usable GPU binary; supported types: ${JSON.stringify(await getLlamaGpuTypes('supported'))}`
      : undefined
    log({ requestedGpu: gpu, gpu: llama.gpu, cpuReason, loadMs, modelSize: model.size })
    const w = performance.now()
    await decision.warmup()
    log({ warmupMs: Math.round(performance.now() - w) })
    return { llama, decision, session: new LlamaChatSession({ contextSequence: chat.getSequence(), systemPrompt: S2_SYSTEM }), grammar }
  } catch (err) {
    await llama.dispose()
    throw err
  }
}

async function judge({ decision, session, grammar }) {
  for (const p of PROBES) {
    const doc = `Intention: ${INTENTION}\nApp: ${p.app}\nTitle: ${p.title.slice(0, 200)}\nURL: ${p.url ?? 'none'}`
    const signal = AbortSignal.timeout(BUDGET_MS)
    const out = { app: p.app, title: p.title }
    const t0 = performance.now()
    try {
      const { label: s1 } = await decision.decide(
        doc,
        {
          label: {
            type: 'choice',
            instruction: 'Does this window serve the stated intention?',
            criteria: {
              serves: 'The window is plausibly used to do the intention',
              drifts: 'The window is unrelated to the intention',
              unclear: 'Cannot tell from the app, title, and URL',
            },
          },
        },
        { signal },
      )
      out.s1 = { choice: s1.choice, confidence: +s1.confidence.toFixed(3), probabilities: s1.probabilities }
      out.s1Ms = Math.round(performance.now() - t0)

      const t1 = performance.now()
      session.resetChatHistory()
      const s2 = grammar.parse(
        await session.prompt(doc, { grammar, maxTokens: 60, signal, budgets: { thoughtTokens: 0 } }),
      )
      out.s2Ms = Math.round(performance.now() - t1)
      out.s2 = s2

      const reason = s2.reason.slice(0, 140)
      const leaks = [p.title, p.url].some((x) => x && reason.toLowerCase().includes(x.toLowerCase()))
      out.label = s1.choice === s2.label && s1.choice !== 'unclear' ? s1.choice : 'unclear'
      out.confidence = out.s1.confidence
      out.reason = leaks ? null : reason
      out.modelStage = 'reason'
    } catch (err) {
      Object.assign(out, { label: 'unclear', confidence: null, reason: null, error: String(err?.message ?? err) })
    }
    out.ms = Math.round(performance.now() - t0)
    log(out)
  }
}
