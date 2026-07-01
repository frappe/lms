import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Duplicate prosemirror-model copies crash tiptap's list buttons. Assert no
// prosemirror core package has multiple installed versions without a dedupe.

const cwd = process.cwd()
const PROSEMIRROR_CORE = [
	'prosemirror-model',
	'prosemirror-state',
	'prosemirror-view',
	'prosemirror-transform',
]

function viteDedupeList(): string[] {
	const config = readFileSync(resolve(cwd, 'vite.config.js'), 'utf8')
	const block = config.match(/dedupe:\s*\[([\s\S]*?)\]/)
	if (!block) return []
	return [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

// Every installed version of `pkg` across nested node_modules trees.
function installedVersions(pkg: string): Set<string> {
	const versions = new Set<string>()

	const visitPackage = (dir: string, name: string) => {
		if (name === pkg) {
			try {
				const { version } = JSON.parse(
					readFileSync(join(dir, 'package.json'), 'utf8')
				)
				if (version) versions.add(version)
			} catch {
				// not a package dir
			}
		}
		walk(join(dir, 'node_modules'))
	}

	const walk = (nmDir: string) => {
		let entries
		try {
			entries = readdirSync(nmDir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue
			if (entry.name.startsWith('@')) {
				const scopeDir = join(nmDir, entry.name)
				let scoped
				try {
					scoped = readdirSync(scopeDir, { withFileTypes: true })
				} catch {
					continue
				}
				for (const s of scoped) {
					if (s.isDirectory()) visitPackage(join(scopeDir, s.name), s.name)
				}
			} else {
				visitPackage(join(nmDir, entry.name), entry.name)
			}
		}
	}

	walk(resolve(cwd, 'node_modules'))
	return versions
}

describe('prosemirror deduping (editor list-button crash guard)', () => {
	it('vite.config dedupes prosemirror-model', () => {
		expect(viteDedupeList()).toContain('prosemirror-model')
	})

	it('dedupes every prosemirror core package installed in multiple versions', () => {
		const dedupe = viteDedupeList()
		const offenders = PROSEMIRROR_CORE.filter((pkg) => {
			const versions = installedVersions(pkg)
			return versions.size > 1 && !dedupe.includes(pkg)
		})
		expect(
			offenders,
			'prosemirror packages present in multiple versions must be in vite resolve.dedupe'
		).toEqual([])
	})
})
