// Prompt-tuning harness for the model stage (S1 decide + S2 reason) over dev-cases.json.
// dev-cases.json is a tuning set, NOT the held-out O4 eval set. Plain Node: `node tune.mjs [variant ...]`.
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getLlama, LlamaChatSession, QwenChatWrapper } from 'node-llama-cpp'

const here = path.dirname(fileURLToPath(import.meta.url))
const CASES = JSON.parse(readFileSync(path.join(here, 'dev-cases.json'), 'utf8'))
const LABELS = ['serves', 'drifts', 'unclear']

const windowText = (c) => `App: ${c.app}\nTitle: ${c.title.slice(0, 200)}\nURL: ${c.url ?? 'none'}`
const fullDoc = (c) => `Intention: ${c.intention}\n${windowText(c)}`
const BASE_CRITERIA = {
  serves: 'The window is plausibly used to do the intention',
  drifts: 'The window is unrelated to the intention',
  unclear: 'Cannot tell from the app, title, and URL',
}
// Concrete definitions: what a working window and a non-working window look like.
const DEFINED_CRITERIA = {
  serves: 'Work on this task: the file, tool, reference page, or message for it',
  drifts: 'Not this task: entertainment, social media, games, shopping, news, or other work',
  unclear: 'Generic window that could be either (new tab, file browser, chat list, calculator)',
}
const reversed = (o) => Object.fromEntries(Object.entries(o).reverse())
const askIntention = (c) => `The person said they are working on: "${c.intention}". Is this window part of that work?`

const S1 = {
  // Current spec (system-design §9).
  base: (c) => [fullDoc(c), { type: 'choice', instruction: 'Does this window serve the stated intention?', criteria: BASE_CRITERIA }],
  // Position control: same text, options in reverse order.
  baseRev: (c) => [fullDoc(c), { type: 'choice', instruction: 'Does this window serve the stated intention?', criteria: reversed(BASE_CRITERIA) }],
  // One change: criteria wording.
  defined: (c) => [fullDoc(c), { type: 'choice', instruction: 'Does this window serve the stated intention?', criteria: DEFINED_CRITERIA }],
  // One change: the intention moves from the document into the question.
  askInt: (c) => [windowText(c), { type: 'choice', instruction: askIntention(c), criteria: BASE_CRITERIA }],
  // Both changes.
  askIntDefined: (c) => [windowText(c), { type: 'choice', instruction: askIntention(c), criteria: DEFINED_CRITERIA }],
  askIntDefinedRev: (c) => [windowText(c), { type: 'choice', instruction: askIntention(c), criteria: reversed(DEFINED_CRITERIA) }],
}

const S2_BASE_SYSTEM =
  'You label one desktop window against the stated intention of a work session. ' +
  'Answer with label serves, drifts, or unclear, and a reason under 140 characters. ' +
  'Never repeat the window title or the URL in the reason.'

// One change vs base: the three labels get the same definitions S1 uses.
const S2_DEFINED_SYSTEM =
  'You check whether one desktop window is part of the work a person said they are doing. ' +
  `Labels: serves = ${DEFINED_CRITERIA.serves}. drifts = ${DEFINED_CRITERIA.drifts}. unclear = ${DEFINED_CRITERIA.unclear}. ` +
  'Judge only whether the window is used for that work, not whether the work is finished. ' +
  'Give a reason under 140 characters. Never repeat the window title or the URL in the reason.'
const askUser = (c) => `${askIntention(c)}\n\n${windowText(c)}`

const S2 = {
  base: { system: S2_BASE_SYSTEM, user: fullDoc, order: ['label', 'reason'], maxTokens: 60 },
  defined: { system: S2_DEFINED_SYSTEM, user: fullDoc, order: ['label', 'reason'], maxTokens: 60 },
  definedAsk: { system: S2_DEFINED_SYSTEM, user: askUser, order: ['label', 'reason'], maxTokens: 60 },
  // Reason before label: the label is conditioned on a short written judgment.
  definedAskReasonFirst: { system: S2_DEFINED_SYSTEM, user: askUser, order: ['reason', 'label'], maxTokens: 80 },
}

const llama = await getLlama({ gpu: 'auto', build: 'never' })
const model = await llama.loadModel({ modelPath: path.join(here, 'models', 'Qwen3.5-2B-Q4_K_M.gguf') })
const decision = await model.createDecisionContext({ contextSize: { max: 1024 } })
const chat = await model.createContext({ contextSize: 2048 })
const seq = chat.getSequence()
console.log(JSON.stringify({ gpu: llama.gpu }))

function grammarFor(order) {
  const props = { label: { enum: LABELS }, reason: { type: 'string', maxLength: 140 } }
  return llama.createGrammarForJsonSchema({ type: 'object', properties: Object.fromEntries(order.map((k) => [k, props[k]])) })
}

async function runS1(name) {
  const rows = []
  for (const c of CASES) {
    const [doc, q] = S1[name](c)
    const { label } = await decision.decide(doc, { label: q })
    rows.push({ id: c.id, expected: c.expected, got: label.choice, conf: label.confidence, p: label.probabilities })
  }
  return rows
}

async function runS2(name) {
  const v = S2[name]
  const grammar = await grammarFor(v.order)
  const session = new LlamaChatSession({ contextSequence: seq, systemPrompt: v.system, chatWrapper: new QwenChatWrapper({ variation: '3.5', thoughts: 'discourage' }) })
  const rows = []
  for (const c of CASES) {
    session.resetChatHistory()
    const out = grammar.parse(await session.prompt(v.user(c), { grammar, maxTokens: v.maxTokens }))
    rows.push({ id: c.id, expected: c.expected, got: out.label, reason: out.reason })
  }
  session.dispose({ disposeSequence: false })
  return rows
}

function confusion(rows) {
  const m = Object.fromEntries(LABELS.map((e) => [e, Object.fromEntries(LABELS.map((g) => [g, 0]))]))
  for (const r of rows) m[r.expected][r.got]++
  return m
}

function summarize(tag, rows) {
  const m = confusion(rows)
  const correct = rows.filter((r) => r.got === r.expected).length
  console.log(`\n== ${tag}: ${correct}/${rows.length} exact`)
  console.log('expected \\ got  ' + LABELS.map((l) => l.padStart(8)).join(''))
  for (const e of LABELS) console.log(e.padEnd(16) + LABELS.map((g) => String(m[e][g]).padStart(8)).join(''))
}

// Agreement rule from the spec, then precision of what would be asserted at each tau.
function combined(tag, s1, s2) {
  const rows = s1.map((a, i) => ({ ...a, s2: s2[i].got, label: a.got === s2[i].got && a.got !== 'unclear' ? a.got : 'unclear' }))
  const asserted = rows.filter((r) => r.label !== 'unclear')
  const right = asserted.filter((r) => r.label === r.expected).length
  console.log(`\n== ${tag} combined: asserted ${asserted.length}/${rows.length}, correct ${right}, precision ${asserted.length ? (right / asserted.length).toFixed(2) : '—'}`)
  for (const tau of [0, 0.2, 0.4, 0.6, 0.8]) {
    const a = asserted.filter((r) => r.conf >= tau)
    const ok = a.filter((r) => r.label === r.expected).length
    console.log(`  tau ${tau.toFixed(1)}: asserted ${a.length}, precision ${a.length ? (ok / a.length).toFixed(2) : '—'}`)
  }
  for (const r of rows.filter((r) => r.label !== 'unclear' && r.label !== r.expected)) console.log(`  WRONG ${r.id} expected ${r.expected} got ${r.label} conf ${r.conf.toFixed(2)}`)
}

const [s1Name = 'base', s2Name = 'base'] = process.argv.slice(2)
await decision.decide('warm', { label: S1[s1Name](CASES[0])[1] })
const s1 = await runS1(s1Name)
summarize(`S1 ${s1Name}`, s1)
if (s2Name === 'none') {
  await llama.dispose()
  process.exit(0)
}
const s2 = await runS2(s2Name)
summarize(`S2 ${s2Name}`, s2)
combined(`S1 ${s1Name} + S2 ${s2Name}`, s1, s2)
if (process.env.VERBOSE) for (let i = 0; i < s1.length; i++) console.log(JSON.stringify({ ...s1[i], p: undefined, conf: +s1[i].conf.toFixed(2), s2: s2[i].got, reason: s2[i].reason }))
await llama.dispose()
