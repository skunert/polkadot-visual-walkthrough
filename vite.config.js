import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Every top-level folder with an index.html is a walkthrough and becomes its
// own page; the root index.html is the landing page that links to them.
const root = import.meta.dirname
const pages = Object.fromEntries(
	readdirSync(root, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !['node_modules', 'dist', 'shared'].includes(d.name))
		.filter((d) => existsSync(resolve(root, d.name, 'index.html')))
		.map((d) => [d.name, resolve(root, d.name, 'index.html')]),
)

export default defineConfig({
	// Relative asset URLs, so the site works under any GitHub Pages path.
	base: './',
	build: {
		rollupOptions: { input: { main: resolve(root, 'index.html'), ...pages } },
	},
})
