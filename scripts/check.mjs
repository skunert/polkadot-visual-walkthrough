// Usage: node scripts/check.mjs <url>
// Counts steps and beats, checks that every multi-beat step has one panel
// bullet per beat, and reports page errors.
import { chromium } from 'playwright'
const [url] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
p.on('pageerror', (e) => errors.push(String(e)))
await p.goto(url); await p.waitForFunction(() => window.__deck)
const info = await p.evaluate(() => {
	const d = window.__deck, out = []
	for (let i = 0; i < d.steps.length; i++) {
		d.go(i, false)
		out.push([d.steps[i].id, d.beatCount(i), document.querySelectorAll('#step-body li').length])
	}
	return out
})
const beats = info.reduce((a, [, n]) => a + n, 0)
console.log('steps', info.length, 'beats', beats)
for (const [id, n, li] of info) if (n > 1 && n !== li) console.log('MISMATCH bullets', id, n, li)
console.log('errors', errors.length, errors.slice(0, 3))
await b.close()
