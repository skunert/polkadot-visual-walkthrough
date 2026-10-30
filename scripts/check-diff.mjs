// Usage: node scripts/check-diff.mjs <url>
// Scrubs the whole timeline forward, then seeks back to every beat end, and
// reports scene elements whose state differs between the two. Numbers are
// rounded to one decimal, which hides invisible sub-pixel noise.
import { chromium } from 'playwright'
const [url] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
await p.goto(url); await p.waitForFunction(() => window.__deck)
const res = await p.evaluate(() => {
	const d = window.__deck, tl = d.tl, ends = []
	for (let i = 0; i < d.steps.length; i++) for (let k = 0; k < d.beatCount(i); k++) { d.show(i, k, false); ends.push([d.steps[i].id, k, tl.time()]) }
	const els = [...document.querySelectorAll('#scene *')]
	const snap = () => els.map((e) => (e.getAttribute('style') || '').replace(/-?\d+\.\d+/g, (m) => (+m).toFixed(1)) + '|' + (e.getAttribute('transform') || '') + '|' + (e.getAttribute('d') || '').length)
	tl.pause(); tl.seek(0)
	let t = 0; const F = []
	for (const [, , e] of ends) { for (let x = t; x < e; x += 0.05) tl.seek(x); tl.seek(e); t = e; F.push(snap()) }
	const out = []
	for (let j = ends.length - 1; j >= 0; j--) {
		tl.seek(ends[j][2]); const B = snap()
		const diffs = []
		B.forEach((v, n) => { if (v !== F[j][n]) diffs.push((els[n].id || els[n].tagName + '.' + els[n].getAttribute('class') + '<' + (els[n].parentNode.id || '')) + ' F:' + F[j][n] + ' B:' + v) })
		if (diffs.length) out.push(ends[j][0] + '#' + ends[j][1] + ': ' + diffs.slice(0, 4).join('\n    '))
	}
	return out
})
console.log(res.slice(-6).join('\n'))
console.log('beats with DOM diffs', res.length)
await b.close()
