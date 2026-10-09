// Ledger smoke spike (map ticket O1/O2/O3): capture + model on one machine. No windows, no network.
import { app, powerMonitor } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import xwin from '@miniben90/x-win'
import { getLlama, getLlamaGpuTypes, InsufficientMemoryError, LlamaChatSession, QwenChatWrapper } from 'node-llama-cpp'

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
// x-win can return "" for a Chromium tab on the first read; the URL is re-read each tick until it appears.
const CHROMIUM = new Set(['chrome', 'msedge', 'brave', 'chromium', 'google-chrome'])
// Throwaway window used to warm S1 and S2 before the probes are timed.
const WARM_PROBE = { app: 'File Explorer', title: 'Downloads', url: null }
// Label definitions shared by S1 criteria and the S2 system prompt (tuned on dev-cases.json with tune.mjs).
const DEFINITIONS = {
  serves: 'Work on this task: the file, tool, reference page, or message for it',
  drifts: 'Not this task: entertainment, social media, games, shopping, news, or other work',
  unclear: 'Generic window that could be either (new tab, file browser, chat list, calculator)',
}
const S2_SYSTEM =
  'You check whether one desktop window is part of the work a person said they are doing. ' +
  `Labels: serves = ${DEFINITIONS.serves}. drifts = ${DEFINITIONS.drifts}. unclear = ${DEFINITIONS.unclear}. ` +
  'Judge only whether the window is used for that work, not whether the work is finished. ' +
  'Give a reason under 140 characters. Never repeat the window title or the URL in the reason.'

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
  const runtime = await loadRuntime()
  await judge(runtime)
  await runtime.llama.dispose()
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
        const xwinMs = Math.round(performance.now() - s)
        const { execName, name, processId } = w.info
        const k = `${execName}\u0000${w.title}`
        const browser = CHROMIUM.has(execName.toLowerCase().replace(/\.exe$/, ''))
        let urlReadMs
        if (k !== key || (url === '' && browser)) {
          key = k
          const u = performance.now()
          try {
            url = w.url
          } catch (err) {
            url = `<url error: ${err.message}>`
          }
          urlReadMs = Math.round(performance.now() - u)
        }
        log({ t, execName, name, title: w.title, url, idle, idleState, own: processId === process.pid, xwinMs, urlReadMs })
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
    // reason before label: S2 writes its judgment, then commits to a label.
    const grammar = await llama.createGrammarForJsonSchema({
      type: 'object',
      properties: { reason: { type: 'string', maxLength: 140 }, label: { enum: LABELS } },
    })
    // The auto-resolved Qwen 3.5 wrapper force-opens a <think> segment, which swallows the grammar's opening "{".
    // "discourage" prefills an empty, closed thought so the response is the grammar JSON alone.
    const session = new LlamaChatSession({
      contextSequence: chat.getSequence(),
      chatWrapper: new QwenChatWrapper({ variation: '3.5', thoughts: 'discourage' }),
      systemPrompt: S2_SYSTEM,
    })
    const cpuReason = llama.gpu === false
      ? gpu === false ? 'gpu:false after InsufficientMemoryError' : `no usable GPU binary; supported types: ${JSON.stringify(await getLlamaGpuTypes('supported'))}`
      : undefined
    log({ requestedGpu: gpu, gpu: llama.gpu, cpuReason, loadMs, modelSize: model.size })

    // warmup() only evaluates the chat prefix; the first choice decide() still pays a one-off ~10 s on Vulkan.
    // Run one throwaway S1 and S2 so the probes below are timed warm.
    let w = performance.now()
    await decision.warmup()
    const warmupMs = Math.round(performance.now() - w)
    w = performance.now()
    await s1(decision, docOf(WARM_PROBE))
    const firstDecideMs = Math.round(performance.now() - w)
    w = performance.now()
    await s2(session, grammar, docOf(WARM_PROBE))
    const firstReasonMs = Math.round(performance.now() - w)
    log({ warmupMs, firstDecideMs, firstReasonMs })
    return { llama, decision, session, grammar }
  } catch (err) {
    await llama.dispose()
    throw err
  }
}

// The intention goes in the question, the window is the document.
const question = () => `The person said they are working on: "${INTENTION}". Is this window part of that work?`
function docOf(p) {
  return `App: ${p.app}\nTitle: ${p.title.slice(0, 200)}\nURL: ${p.url ?? 'none'}`
}

async function s1(decision, doc, signal) {
  const { label } = await decision.decide(doc, { label: { type: 'choice', instruction: question(), criteria: DEFINITIONS } }, { signal })
  return label
}

async function s2(session, grammar, doc, signal) {
  session.resetChatHistory()
  return grammar.parse(await session.prompt(`${question()}\n\n${doc}`, { grammar, maxTokens: 80, signal }))
}

async function judge({ decision, session, grammar }) {
  for (const p of PROBES) {
    const doc = docOf(p)
    const signal = AbortSignal.timeout(BUDGET_MS)
    const out = { app: p.app, title: p.title }
    const t0 = performance.now()
    try {
      const a = await s1(decision, doc, signal)
      out.s1 = { choice: a.choice, confidence: +a.confidence.toFixed(3), probabilities: a.probabilities }
      out.s1Ms = Math.round(performance.now() - t0)

      const t1 = performance.now()
      const b = await s2(session, grammar, doc, signal)
      out.s2Ms = Math.round(performance.now() - t1)
      out.s2 = b

      const reason = b.reason.slice(0, 140)
      const leaks = [p.title, p.url].some((x) => x && reason.toLowerCase().includes(x.toLowerCase()))
      out.label = a.choice === b.label && a.choice !== 'unclear' ? a.choice : 'unclear'
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
