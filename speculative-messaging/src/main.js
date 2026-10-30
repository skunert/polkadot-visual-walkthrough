import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { steps, chips } from './steps.js'

gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin)
gsap.defaults({ ease: 'power2.inOut' })

// ── Timeline helpers ────────────────────────────────────────────
// Every state change is a tween on the one master timeline, so seeking
// backwards restores earlier states for free. No callbacks, no DOM writes.
//
// Rule: whatever a step shows stays on screen when the step ends. A builder
// returns the selectors of its transient elements (tokens, trails, fold
// lines); they are cleared as the first action of the next step.
//
// Elements are animated in several parts of the walkthrough (overview, deep
// dive, replay), so builders only use `set` and `to`: a `from`/`fromTo` on a
// reused element would leak its start state into earlier steps when seeking
// back. The exceptions animate elements that appear exactly once (cards).

const fadeIn = (tl, sel, pos) => tl.to(sel, { opacity: 1, duration: 0.4 }, pos)
const fadeOut = (tl, sel, pos) => tl.to(sel, { opacity: 0, duration: 0.3 }, pos)

function swap(tl, from, to, pos) {
	tl.to(from, { opacity: 0, duration: 0.3 }, pos)
	tl.to(to, { opacity: 1, duration: 0.3 }, '<')
}

function pulse(tl, sel, pos, scale = 1.18) {
	tl.to(sel, {
		scale,
		transformOrigin: '50% 50%',
		duration: 0.18,
		yoyo: true,
		repeat: 1,
		ease: 'power1.inOut',
	}, pos)
}

// Briefly thicken a border. autoRound is off: GSAP rounds px values by default,
// which would leave a 1.5 px border at 2 px after the flash.
function flash(tl, sel, pos) {
	tl.to(sel, { strokeWidth: 4, duration: 0.15, yoyo: true, repeat: 1, autoRound: false }, pos)
}

function travel(tl, token, path, duration = 0.9, pos) {
	tl.to(token, { motionPath: { path }, duration, ease: 'power1.inOut' }, pos)
}

// Draw a line from nothing. Lines start undrawn (see the initial state below).
function drawLine(tl, sel, duration = 0.6, pos, opacity = 1) {
	tl.set(sel, { opacity, drawSVG: '0%' }, pos)
	tl.to(sel, { drawSVG: '100%', duration }, '<')
}

// A new leaf fades in at its slot.
const addLeaf = (tl, sel, pos) => {
	tl.set(sel, { opacity: 0 }, pos)
	tl.to(sel, { opacity: 1, duration: 0.5 }, '<')
}

// A token fades in at its start point before it travels anywhere.
const appear = (tl, sel, x, y, pos) => {
	tl.set(sel, { opacity: 0, x, y }, pos)
	tl.to(sel, { opacity: 1, duration: 0.25 }, '<')
}

// Beats: pause points inside a step. Each press of → plays one beat, and the
// panel reveals the step's bullets one per beat. `clear` lists transients of
// the beat just finished; they fade as the first action of the next beat.
let beatMarks = []
function beat(tl, clear) {
	beatMarks.push(tl.duration())
	if (clear?.length) fadeOut(tl, clear)
}

// Block tabs: one per block of each chain (index k = N+k or M+k). A tab is
// amber while its block is built or travels through JAM, green once enacted.
// The previous tab of that chain gives way; tracked at build time, which
// follows timeline order.
const tabNow = { a: null, b: null }
function tab(tl, c, k, ok, pos) {
	const next = `#tab-${c}-${k}${ok ? '-ok' : ''}`
	if (tabNow[c]) swap(tl, tabNow[c], next, pos)
	else fadeIn(tl, next, pos)
	tabNow[c] = next
}

// Accumulate's settlement check: a line from Accumulate to the required root
// in the sender's ring, which is there.
function checkDependency(tl, [line, label, ring]) {
	drawLine(tl, line, 0.8)
	pulse(tl, ring, undefined, 1.3)
	fadeIn(tl, label)
}

// A block that only read from B (no root of its own) still goes through JAM,
// and Accumulate checks its dependency against B's ring: compact version.
function settleImport(tl, line, label, ring, k) {
	flash(tl, '#colA rect')
	flash(tl, '#refine rect')
	flash(tl, '#accumulate rect')
	checkDependency(tl, [line, label, ring])
	tab(tl, 'a', k, true)
}

// A visible copy of each settlement motion path, drawn behind its token.
const trails = document.getElementById('trails')
for (const id of ['pA1', 'pA2', 'pA3', 'pA4', 'pA5', 'pB1', 'pB2', 'pB3', 'pB4', 'pB5', 'pB6']) {
	const t = document.getElementById(id).cloneNode()
	t.id = `trail-${id}`
	t.setAttribute('class', `trail ${id[1].toLowerCase()}`)
	trails.append(t)
}

// Initial state, outside the timeline: every reusable line starts undrawn.
gsap.set('.trail, .fold, .read-line, .check-line', { drawSVG: '0%' })

function travelWithTrail(tl, token, path, duration) {
	tl.set(`#trail-${path}`, { opacity: 0.6, drawSVG: '0%' })
	travel(tl, token, `#${path}`, duration)
	tl.to(`#trail-${path}`, { drawSVG: '100%', duration, ease: 'power1.inOut' }, '<')
}

// Token from a runtime's StreamsRoot via its collator through Refine and
// Accumulate into its settlement ring. `p` is the path prefix, `c` the chain;
// `last` picks the final path segment, which ends at the ring slot `ring`.
// The token becomes the ring entry; the route stays drawn as a trail.
// `check` runs the block's settlement check (see checkDependency) before the
// root is pushed. `speed` < 1 plays it compressed.
function settleRoot(tl, c, p, { tok = `#tok${c}`, last = 4, ring, check, speed = 1 } = {}) {
	const l = c.toLowerCase()
	ring ??= `#${l}-ring0`
	appear(tl, tok, c === 'A' ? 434 : 1054, 70)
	travelWithTrail(tl, tok, `${p}1`, 1.0 * speed)
	flash(tl, `#col${c} rect`)
	travelWithTrail(tl, tok, `${p}2`, 1.0 * speed)
	flash(tl, '#refine rect')
	travelWithTrail(tl, tok, `${p}3`, 0.6 * speed)
	flash(tl, '#accumulate rect')
	if (check) checkDependency(tl, check)
	travelWithTrail(tl, tok, `${p}${last}`, 0.9 * speed)
	fadeOut(tl, tok)
	tl.to(ring, { opacity: 1, duration: 0.3 }, '<')
	pulse(tl, ring, '<', 1.25)
	return [1, 2, 3, last].map((i) => `#trail-${p}${i}`).concat(check ? check.slice(0, 2) : [])
}

// After a block, its collator pulls the block's sends via outbound_messages()
// into its node-local archive: leaf copies fly from the stream row into the
// archive chips. Each item is [leaf index, from x, from y, to x].
function archiveSends(tl, c, items, speed = 1) {
	fadeIn(tl, `#${c}-archive`)
	const at = tl.duration() + 0.1 // all copies leave together
	const arrive = at + 0.25 + 0.8 * speed
	for (const [i, fx, fy, tx] of items) {
		appear(tl, `#fly-${c}${i}`, fx, fy, at)
		tl.to(`#fly-${c}${i}`, { x: tx, y: 427, duration: 0.8 * speed }, at + 0.25)
		tl.to(`#fly-${c}${i}`, { opacity: 0, duration: 0.3 }, arrive)
		tl.to(`#arc-${c}${i}`, { opacity: 1, duration: 0.4 }, arrive)
	}
	flash(tl, `#col${c.toUpperCase()} rect`)
}

// One send: the call is logged, the in-flight gate ticks up, and the message
// flies from the log into its slot as a pending leaf of this block.
function sendData(tl, i, slotX, fillWidth, speed = 1) {
	const logX = i === 1 ? 190 : 340
	fadeIn(tl, `#send-log${i}`, '+=0.2')
	pulse(tl, '#a-credit-fill', undefined, 1.15)
	tl.to('#a-credit-fill', { attr: { width: fillWidth }, duration: 0.3 })
	swap(tl, i === 1 ? '#a-cr-0a' : `#a-cr-${i - 1}`, `#a-cr-${i}`, '<')
	appear(tl, `#fly${i}`, logX, 294)
	tl.to(`#fly${i}`, { x: slotX, y: 138, duration: 0.7 * speed })
	fadeOut(tl, `#fly${i}`)
	tl.to(`#a-leaf${i}`, { opacity: 1, duration: 0.3 }, '<')
}

// Off-chain request/response between the collators.
// A collator checked fetched payloads against a root: their borders turn green.
function verified(tl, sels, pos) {
	const off = getComputedStyle(document.documentElement).getPropertyValue('--off').trim()
	tl.to([sels].flat().map((s) => `${s} rect`), { stroke: off, duration: 0.3 }, pos)
}

function exchange(tl, req, reqPath, reqAt, resp, respPath, respAt, server) {
	fadeIn(tl, '#offchain-band-hi')
	appear(tl, req, reqAt[0], reqAt[1])
	travel(tl, req, reqPath, 1.0)
	flash(tl, `${server} rect`)
	appear(tl, resp, respAt[0], respAt[1], '+=0.1')
	travel(tl, resp, respPath, 1.0)
}

// ── The script, one builder per step ─────────────────────────────

const OV = 0.55 // pace of the compressed settlements during channel setup

const build = {
	// ════════ Introduction and channel setup ════════

	goal(tl) {
		tl.set('#goal', { opacity: 1 })
		tl.from(['#goal-head', '#goal-diagram', '#goal-hint'], { opacity: 0, duration: 0.8 })
		tl.fromTo('#goal-arrow', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6 })
		fadeIn(tl, '#goal-msg')
		tl.to('#goal-msg', { motionPath: { path: '#goal-arrow' }, duration: 1.2, ease: 'power1.inOut' })
		return ['#goal']
	},

	why(tl) {
		tl.fromTo('#why', { opacity: 0 }, { opacity: 1, duration: 0.5 })
		// Today: the messages go into the relay chain runtime and are delivered from there.
		appear(tl, '#why-l-in', 200, 330, '+=0.2')
		travel(tl, '#why-l-in', '#pWhyIn', 1.0)
		fadeOut(tl, '#why-l-in')
		fadeIn(tl, '#why-l-stored', '<')
		appear(tl, '#why-l-out', 340, 533, '+=0.3')
		travel(tl, '#why-l-out', '#pWhyOut', 1.0)
		fadeOut(tl, '#why-l-out')
		fadeIn(tl, '#why-l-dest', '<')
		beat(tl)
		// New: the messages go collator to collator; only a root goes on chain.
		fadeIn(tl, '#why-new')
		appear(tl, '#why-r-fly', 802, 300, '+=0.2')
		travel(tl, '#why-r-fly', '#pWhyLane', 0.9)
		fadeOut(tl, '#why-r-fly')
		fadeIn(tl, '#why-r-dest', '<')
		appear(tl, '#why-root-fly', 720, 330, '+=0.2')
		travel(tl, '#why-root-fly', '#pWhyRoot', 1.0)
		fadeOut(tl, '#why-root-fly')
		fadeIn(tl, '#why-root', '<')
		pulse(tl, '#why-root', undefined, 1.15)
		return ['#why']
	},

	intro(tl) {
		tl.from(['#chainA', '#chainB', '#offchain-band', '#colA', '#colB', '#jam-frame', '#jam'], {
			opacity: 0,
			duration: 0.6,
		})
	},

	// Block M: B accepts the channel and publishes Reg₀ (Accepting).
	'ov-accept'(tl) {
		fadeIn(tl, '#user')
		tl.set('#tx', { x: 1100, y: 411 })
		travel(tl, '#tx', '#pTx1', 0.7)
		tl.to('#tx', { opacity: 1, duration: 0.3 }, '<')
		flash(tl, '#colB rect')
		tab(tl, 'b', 0, false, '<')
		travel(tl, '#tx', '#pTx2', 0.5)
		beat(tl, ['#tx', '#user'])
		swap(tl, '#b-empty', '#b-channel', '<')
		fadeIn(tl, '#b-phase-accepting')
		addLeaf(tl, '#b-leaf0p', '+=0.1')
		fadeIn(tl, '#b-leaf0-detail')
		beat(tl)
		drawLine(tl, '#b-fold', 0.5)
		swap(tl, '#b-root-0', '#b-root-1')
		pulse(tl, '#b-root-pill', '<')
		swap(tl, '#b-leaf0p', '#b-leaf0', '<')
		archiveSends(tl, 'b', [[0, 794, 210, 886]], OV)
		beat(tl, ['#b-fold'])
		const route = settleRoot(tl, 'B', 'pB', { speed: OV })
		tab(tl, 'b', 0, true)
		return route
	},

	// Block N: A reads Reg₀ and answers with Hello as message #0.
	'ov-hello'(tl) {
		pulse(tl, '#b-ring0', undefined, 1.25)
		drawLine(tl, '#read-line', 0.7)
		beat(tl)
		exchange(tl, '#req', '#pReq', [530, 399], '#resp', '#pResp', [655, 426], '#colB')
		fadeIn(tl, ['#a-fetched', '#fet-a0'])
		verified(tl, '#fet-a0')
		beat(tl, ['#read-line', '#req', '#resp', '#offchain-band-hi', '#a-fetched', '#fet-a0'])
		tab(tl, 'a', 0, false, '<')
		appear(tl, '#inh', 290, 411)
		travel(tl, '#inh', '#pInh', 0.6)
		swap(tl, '#a-ack-none', '#a-ack-reg', '+=0.1')
		addLeaf(tl, '#a-leaf0p', '+=0.2')
		fadeIn(tl, '#a-phase-hello', '<')
		fadeIn(tl, '#a-credit', '+=0.1')
		beat(tl, ['#inh'])
		drawLine(tl, '#a-fold', 0.5)
		swap(tl, '#a-root-0', '#a-root-1')
		pulse(tl, '#a-root-pill', '<')
		swap(tl, '#a-leaf0p', '#a-leaf0', '<')
		archiveSends(tl, 'a', [[0, 174, 138, 266]], OV)
		beat(tl, ['#a-fold'])
		const route = settleRoot(tl, 'A', 'pA', {
			speed: OV,
			check: ['#check-lineB', '#check-lblB', '#b-ring0'],
		})
		tab(tl, 'a', 0, true)
		return route
	},

	// Block M+1: B consumes Hello, the channel is Opened, B publishes Reg₁.
	'ov-opened'(tl) {
		pulse(tl, '#a-ring0', undefined, 1.25)
		drawLine(tl, '#read-lineA1', 0.8)
		exchange(tl, '#hreq', '#pMReq', [670, 399], '#hresp', '#pMResp', [545, 426], '#colA')
		pulse(tl, '#arc-a0', '-=1.2', 1.2) // served from the archive
		fadeIn(tl, ['#b-fetched', '#fet-bh'])
		verified(tl, '#fet-bh')
		beat(tl, ['#read-lineA1', '#hreq', '#hresp', '#offchain-band-hi'])
		tab(tl, 'b', 1, false, '<')
		appear(tl, '#inhH', 910, 411)
		travel(tl, '#inhH', '#pTx2', 0.6)
		fadeOut(tl, ['#b-fetched', '#fet-bh'], '<')
		addLeaf(tl, '#b-in0', '+=0.1')
		fadeIn(tl, '#b-record0')
		swap(tl, '#b-phase-accepting', '#b-phase-opened', '<')
		beat(tl, ['#inhH'])
		addLeaf(tl, '#b-leaf1p')
		swap(tl, '#b-leaf0-detail', '#b-leaf1-detail', '<')
		drawLine(tl, '#b-fold', 0.5)
		swap(tl, '#b-root-1', '#b-root-2')
		pulse(tl, '#b-root-pill', '<')
		swap(tl, '#b-leaf1p', '#b-leaf1', '<')
		archiveSends(tl, 'b', [[1, 848, 210, 930]], OV)
		beat(tl, ['#b-fold'])
		const route = settleRoot(tl, 'B', 'pB', {
			tok: '#tokB2',
			last: 5,
			ring: '#b-ring1',
			speed: OV,
			check: ['#check-lineA1', '#check-lblA1', '#a-ring0'],
		})
		tab(tl, 'b', 1, true)
		return route
	},

	// Block N+1: A reads Reg₁ (Opened); nothing is in flight any more.
	'ov-read'(tl) {
		pulse(tl, '#b-ring1', undefined, 1.25)
		drawLine(tl, '#read-line3', 0.7)
		exchange(tl, '#req2', '#pReq', [530, 399], '#resp2', '#pResp', [655, 426], '#colB')
		fadeIn(tl, ['#a-fetched', '#fet-a1'])
		verified(tl, '#fet-a1')
		beat(tl, ['#read-line3', '#req2', '#resp2', '#offchain-band-hi', '#a-fetched', '#fet-a1'])
		tab(tl, 'a', 1, false, '<')
		appear(tl, '#inh2', 290, 411)
		travel(tl, '#inh2', '#pInh', 0.6)
		swap(tl, '#a-ack-reg-l1', '#a-ack-reg2', '+=0.1')
		swap(tl, '#a-req-line', '#a-req2', '<')
		swap(tl, '#a-phase-hello', '#a-phase-open')
		tl.to('#a-credit-fill', { attr: { width: 0.01 }, duration: 0.5 })
		swap(tl, '#a-cr-h', '#a-cr-0a', '<')
		beat(tl, ['#inh2'])
		settleImport(tl, '#check-lineB2', '#check-lblB2', '#b-ring1', 1)
		return ['#check-lineB2', '#check-lblB2']
	},

	// ════════ Block N's messages, in detail ════════

	// A sends block N

	's1-intro'(tl) {
		fadeOut(tl, '#a-req2') // dependencies are per block
		tab(tl, 'a', 2, false, '<')
		flash(tl, '#colA rect')
		flash(tl, '#chainA .box')
		pulse(tl, '#a-credit', '+=0.1', 1.05)
	},

	's1-send'(tl) {
		fadeIn(tl, '#a-split')
		sendData(tl, 1, 228, 7.5)
		sendData(tl, 2, 282, 15)
		return ['#send-log1', '#send-log2']
	},

	's1-bag'(tl) {
		tl.fromTo('#bag', { opacity: 0 }, { opacity: 1, duration: 0.4 })
		tl.fromTo('#mmr-l1', { opacity: 0 }, { opacity: 1, duration: 0.4 }, '+=0.3')
		tl.fromTo(['#mmr-e0', '#mmr-e1'], { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.4 })
		fadeIn(tl, '#mmr-n01', '-=0.1')
		tl.fromTo('#mmr-l2', { opacity: 0 }, { opacity: 1, duration: 0.4 }, '+=0.3')
		fadeIn(tl, '#mmr-peaks', '+=0.2')
		pulse(tl, ['#mmr-n01', '#mmr-l2'], '<')
		tl.fromTo(['#mmr-b0', '#mmr-b1'], { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5 }, '+=0.2')
		fadeIn(tl, '#mmr-root')
		pulse(tl, '#mmr-root', undefined, 1.08)
	},

	's1-fold'(tl) {
		fadeIn(tl, '#bag-right')
		appear(tl, '#bag-fly', 320, 393, '+=0.2')
		tl.to('#bag-fly', { x: 710, y: 455, duration: 1 })
		fadeOut(tl, '#bag-fly')
		swap(tl, '#trie-leaf-old', '#trie-leaf-new', '<')
		tl.fromTo('#trie-edge-hot', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5 })
		swap(tl, '#trie-root-0', '#trie-root-1')
		pulse(tl, '#trie-root-g', '<', 1.1)
		fadeIn(tl, '#bag-out', '+=0.3')
		return ['#bag']
	},

	's1-outputs'(tl) {
		swap(tl, '#a-root-1', '#a-root-2')
		pulse(tl, '#a-root-pill', '<')
		swap(tl, ['#a-leaf1', '#a-leaf2'], ['#a-leaf1s', '#a-leaf2s'], '<')
		archiveSends(tl, 'a', [[1, 228, 138, 310], [2, 282, 138, 354]])
	},

	// Block N settles on JAM

	's2-package'(tl) {
		flash(tl, '#colA rect')
		appear(tl, '#wp', 290, 411)
		travelWithTrail(tl, '#wp', 'pA2', 1.2)
		flash(tl, '#refine rect')
		fadeOut(tl, '#wp')
		fadeIn(tl, '#refine-wp', '<')
		return ['#trail-pA2']
	},

	's2-refine'(tl) {
		const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `#rf-r${i}`)
		tl.fromTo(['#rf-card', ...rows, '#rf-foot'], { opacity: 0 }, { opacity: 1, duration: 0.4 })
		pulse(tl, '#rf-r6', '+=0.3', 1.03)
		return ['#rf-card']
	},

	's2-join'(tl) {
		fadeOut(tl, '#refine-wp')
		appear(tl, '#dg', 580, 584)
		travelWithTrail(tl, '#dg', 'pA3', 1.0)
		fadeIn(tl, '#join-badges', '-=0.5')
		flash(tl, '#accumulate rect')
		fadeOut(tl, '#dg')
		fadeIn(tl, '#acc-digest', '<')
		return ['#trail-pA3', '#join-badges']
	},

	's2-accumulate'(tl) {
		tl.fromTo('#ac-card', { opacity: 0 }, { opacity: 1, duration: 0.4 })
		for (let i = 1; i <= 7; i++) {
			tl.fromTo(`#ac-r${i}`, { opacity: 0 }, { opacity: 1, duration: 0.3 }, '+=0.2')
		}
		pulse(tl, '#ac-r5', undefined, 1.03)
		fadeIn(tl, '#ac-foot', '+=0.2')
		return ['#ac-card']
	},

	's2-enact'(tl) {
		fadeOut(tl, '#acc-digest')
		appear(tl, '#tokA2', 580, 684)
		travelWithTrail(tl, '#tokA2', 'pA5', 1.0)
		fadeOut(tl, '#tokA2')
		fadeIn(tl, '#a-ring1', '<')
		pulse(tl, '#a-ring1', '<', 1.25)
		tab(tl, 'a', 2, true)
		pulse(tl, '#tab-a-2-ok', '<')
		return ['#trail-pA5']
	},

	// B fetches the messages

	's3-notice'(tl) {
		pulse(tl, '#a-ring1', undefined, 1.25)
		drawLine(tl, '#read-line2', 1)
		flash(tl, '#colB rect')
	},

	's3-fetch'(tl) {
		exchange(tl, '#mreq', '#pMReq', [670, 399], '#mresp', '#pMResp', [545, 426], '#colA')
		pulse(tl, ['#arc-a1', '#arc-a2'], '-=1.2', 1.2) // served from the archive
		flash(tl, '#colB rect')
		fadeIn(tl, ['#b-fetched', '#fet-b1', '#fet-b2'], '<')
		return ['#mreq', '#mresp', '#offchain-band-hi', '#read-line2']
	},

	's3-verify'(tl) {
		tl.fromTo('#vf-card', { opacity: 0 }, { opacity: 1, duration: 0.4 })
		for (let i = 0; i <= 3; i++) {
			tl.fromTo(`#vf-r${i}`, { opacity: 0 }, { opacity: 1, duration: 0.3 }, '+=0.25')
		}
		pulse(tl, '#vf-r3', undefined, 1.03)
		fadeIn(tl, '#vf-foot', '+=0.2')
		verified(tl, ['#fet-b1', '#fet-b2'], '<') // the staged payloads are now trusted
		return ['#vf-card']
	},

	// B consumes them

	's4-inherent'(tl) {
		tab(tl, 'b', 2)
		fadeOut(tl, '#b-record0', '<') // consumption records are per block
		flash(tl, '#colB rect')
		appear(tl, '#inhB', 910, 411)
		travel(tl, '#inhB', '#pTx2', 0.8)
		fadeOut(tl, ['#b-fetched', '#fet-b1', '#fet-b2'], '<')
		return ['#inhB']
	},

	's4-consume'(tl) {
		flash(tl, '#chainB .box')
		addLeaf(tl, '#b-in1', '+=0.1')
		addLeaf(tl, '#b-in2', '-=0.3')
		fadeIn(tl, '#b-queue', '+=0.2')
		fadeIn(tl, '#b-record', '+=0.3')
	},

	// Block end: B's register changed, so it publishes Reg₂ and a new root.
	's4-register'(tl) {
		addLeaf(tl, '#b-leaf2p')
		swap(tl, '#b-leaf1-detail', '#b-leaf2-detail', '<')
		drawLine(tl, '#b-fold', 0.5, '+=0.2')
		swap(tl, '#b-root-2', '#b-root-3')
		pulse(tl, '#b-root-pill', '<')
		swap(tl, '#b-leaf2p', '#b-leaf2', '<')
		archiveSends(tl, 'b', [[2, 902, 210, 974]])
		return ['#b-fold']
	},

	's5-package'(tl) {
		flash(tl, '#colB rect')
		appear(tl, '#wpB', 910, 411)
		travelWithTrail(tl, '#wpB', 'pB2', 1.2)
		flash(tl, '#refine rect')
		fadeOut(tl, '#wpB')
		fadeIn(tl, '#refine-wpB', '<')
		return ['#trail-pB2']
	},

	's5-refine'(tl) {
		tl.fromTo('#rf2-card', { opacity: 0 }, { opacity: 1, duration: 0.4 })
		for (let i = 0; i <= 5; i++) {
			tl.fromTo(`#rf2-r${i}`, { opacity: 0 }, { opacity: 1, duration: 0.3 }, '+=0.25')
		}
		pulse(tl, ['#rf2-r4', '#rf2-r5'], undefined, 1.03)
		fadeIn(tl, '#rf2-foot', '+=0.2')
		return ['#rf2-card']
	},

	// Block M settles

	's5-settle'(tl) {
		fadeOut(tl, '#refine-wpB')
		appear(tl, '#dgB', 580, 584)
		travelWithTrail(tl, '#dgB', 'pB3', 1.0)
		flash(tl, '#accumulate rect')
		fadeOut(tl, '#dgB')
		fadeIn(tl, '#acc-digestB', '<')
		checkDependency(tl, ['#check-line', '#check-lbl', '#a-ring1'])
		appear(tl, '#tokB3', 580, 684, '+=0.3')
		travelWithTrail(tl, '#tokB3', 'pB6', 1.0)
		fadeOut(tl, '#tokB3')
		fadeIn(tl, '#b-ring2', '<')
		pulse(tl, '#b-ring2', '<', 1.25)
		tab(tl, 'b', 2, true, '+=0.2')
		pulse(tl, '#tab-b-2-ok', '<')
		return ['#trail-pB3', '#trail-pB6', '#acc-digestB', '#check-line', '#check-lbl']
	},

	// Credit flows back

	'ov-credit'(tl) {
		pulse(tl, '#b-ring2', undefined, 1.25)
		drawLine(tl, '#read-line4', 0.7)
		exchange(tl, '#req3', '#pReq', [530, 399], '#resp3', '#pResp', [655, 426], '#colB')
		fadeIn(tl, ['#a-fetched', '#fet-a2'])
		verified(tl, '#fet-a2')
		beat(tl, ['#read-line4', '#req3', '#resp3', '#offchain-band-hi', '#a-fetched', '#fet-a2'])
		// Block N+3: the inherent brings the new register.
		tab(tl, 'a', 3, false, '<')
		appear(tl, '#inh3', 290, 411)
		travel(tl, '#inh3', '#pInh', 0.6)
		fadeOut(tl, '#a-split')
		swap(tl, '#a-ack-reg2', '#a-ack-reg3')
		tl.to('#a-credit-fill', { attr: { width: 0.01 }, duration: 0.5 })
		swap(tl, '#a-cr-2', '#a-cr-0', '<')
		fadeIn(tl, '#a-req3')
		settleImport(tl, '#check-lineB3', '#check-lblB3', '#b-ring2', 3)
		beat(tl, ['#inh3', '#check-lineB3', '#check-lblB3'])
		fadeOut(tl, ['#arc-a0', '#arc-a1', '#arc-a2'])
		fadeIn(tl, '#arc-a-pruned', '+=0.1')
	},

	summary(tl) {
		pulse(tl, ['#a-ring0', '#a-ring1', '#b-ring0', '#b-ring1', '#b-ring2'], undefined, 1.25)
	},
}

const tl = gsap.timeline({ paused: true })
const marks = {} // step id → beat boundaries inside the step
let leftovers = []
for (const s of steps) {
	tl.addLabel(s.id)
	if (leftovers.length) fadeOut(tl, leftovers)
	beatMarks = []
	leftovers = build[s.id](tl) ?? []
	marks[s.id] = beatMarks
	tl.to({}, { duration: 0.15 }) // breathing room before the step ends
}

const starts = steps.map((s) => tl.labels[s.id])
// End a hair before the next label: seeking exactly onto it would already
// fire the next step's zero-length sets.
const ends = steps.map((_, i) => (starts[i + 1] ?? tl.duration() + 1e-3) - 1e-3)

// Beat k of step i plays from bounds[i][k] to just before bounds[i][k + 1].
const bounds = steps.map((s, i) => [starts[i], ...marks[s.id], ends[i] + 1e-3])
const beatCount = (i) => bounds[i].length - 1
const beatStart = (i, k) => bounds[i][k]
const beatEnd = (i, k) => bounds[i][k + 1] - 1e-3

// ── Navigation ──────────────────────────────────────────────────

const $ = (id) => document.getElementById(id)
const stageNames = [...new Set(steps.map((s) => s.stage))]
const stageFirst = stageNames.map((n) => steps.findIndex((s) => s.stage === n))
const stageBtns = stageNames.map((name, k) => {
	const b = document.createElement('button')
	b.textContent = chips[name]
	b.title = name
	b.addEventListener('click', () => go(stageFirst[k], true))
	$('stages').append(b)
	return b
})
const dots = steps.map((s, i) => {
	const b = document.createElement('button')
	b.title = s.title.replace(/<[^>]+>/g, '')
	b.addEventListener('click', () => go(i, true))
	$('dots').append(b)
	return b
})

let cur = 0
let beatIdx = 0
let playing = null

function render() {
	const s = steps[cur]
	const k = stageNames.indexOf(s.stage)
	const inStage = steps.filter((t) => t.stage === s.stage).length
	const n = beatCount(cur)
	$('stage').textContent = `${s.stage} · step ${cur - stageFirst[k] + 1}/${inStage}`
		+ (n > 1 ? ` · ${beatIdx + 1}/${n}` : '')
	stageBtns.forEach((b, j) => {
		b.classList.toggle('current', j === k)
		b.classList.toggle('done', j < k)
	})
	$('step-title').innerHTML = s.title
	$('step-body').innerHTML = s.body
	// One bullet per beat: earlier ones stay, the current one is highlighted,
	// later ones appear when their beat plays.
	if (n > 1) {
		$('step-body').querySelectorAll('li').forEach((li, j) => {
			li.classList.toggle('past', j < beatIdx)
			li.classList.toggle('now', j === beatIdx)
			li.classList.toggle('later', j > beatIdx && beatIdx < n - 1)
		})
	}
	dots.forEach((d, i) => {
		d.classList.toggle('done', i < cur)
		d.classList.toggle('current', i === cur)
		d.classList.toggle('other-stage', steps[i].stage !== s.stage)
	})
	$('prev').disabled = cur === 0 && beatIdx === 0
	$('next').disabled = cur === steps.length - 1 && beatIdx === n - 1
	history.replaceState(null, '', `#${cur}`)
}

// Play beat k of step i from its start, or show its end state.
function show(i, k, animate) {
	playing?.kill()
	playing = null
	cur = i
	beatIdx = k
	render()
	if (animate) {
		tl.seek(beatStart(i, k))
		playing = tl.tweenFromTo(beatStart(i, k), beatEnd(i, k), { ease: 'none' })
	} else {
		tl.seek(beatEnd(i, k))
	}
}

// Whole steps: animate from the first beat, or jump to the finished step.
const go = (i, animate) => (animate ? show(i, 0, true) : show(i, beatCount(i) - 1, false))

function next() {
	if (playing?.isActive()) return show(cur, beatIdx, false) // first press skips the animation
	if (beatIdx < beatCount(cur) - 1) show(cur, beatIdx + 1, true)
	else if (cur < steps.length - 1) show(cur + 1, 0, true)
}

function prev() {
	if (beatIdx > 0) show(cur, beatIdx - 1, false)
	else if (cur > 0) go(cur - 1, false)
}

$('next').addEventListener('click', next)
$('prev').addEventListener('click', prev)
$('replay').addEventListener('click', () => show(cur, beatIdx, true))

document.addEventListener('keydown', (e) => {
	if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) next()
	else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) prev()
	else if (e.key === 'r' || e.key === 'R') show(cur, beatIdx, true)
	else if (e.key === 'Home') go(0, true)
	else return
	e.preventDefault()
})

// Deep links (#3) land on the finished state of that step.
const initial = Number.parseInt(location.hash.slice(1), 10)
if (initial > 0 && initial < steps.length) go(initial, false)
else go(0, true)

// Hook for the screenshot script.
window.__deck = { go, show, beatCount, steps, tl, starts, ends }
