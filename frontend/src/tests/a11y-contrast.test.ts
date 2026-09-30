// In frappe-ui rc.1, ink-gray-5 text is 4.18:1 on white and 3.76:1 on
// surface-gray-2, under AA's 4.5:1; ink-gray-6 clears it. Icons are exempt
// from 1.4.3, so ink-gray-5 may only colour an element with no text of its own.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'vue/compiler-sfc'

const SRC = join(__dirname, '..')
const CLASS = /text-ink-gray-5\b/g

// @vue/compiler-core NodeTypes
const ELEMENT = 1
const TEXT = 2
const INTERPOLATION = 5
const ATTRIBUTE = 6
const DIRECTIVE = 7

type Node = {
	type: number
	tag?: string
	content?: string
	props?: Array<{
		type: number
		name: string
		value?: { content: string }
		arg?: { content: string }
		exp?: { content: string }
	}>
	children?: Node[]
}

const TEXT_DIRECTIVES = new Set(['text', 'html', 'safe-html'])

const iconImports = (source: string) => {
	const names = new Set(['LoadingIndicator'])
	const imports = source.matchAll(
		/import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\}|(\w+))\s+from\s+'(lucide-vue-next|@\/components\/Icons\/[^']+)'/g
	)
	for (const [, namespace, named, fallback] of imports) {
		const list = namespace ?? fallback ?? named
		for (const name of list.split(',')) {
			const alias = name
				.split(/\s+as\s+/)
				.pop()
				?.trim()
			if (alias) names.add(alias)
		}
	}
	return names
}

type Prop = NonNullable<Node['props']>[number]

const propClass = (p: Prop) => {
	if (p.type === ATTRIBUTE && p.name === 'class') return p.value?.content ?? ''
	const isClassBind =
		p.type === DIRECTIVE && p.name === 'bind' && p.arg?.content === 'class'
	return isClassBind ? p.exp?.content ?? '' : ''
}

const classText = (node: Node) => (node.props ?? []).map(propClass).join(' ')

const isComponentTag = (tag: string) =>
	/^[A-Z]/.test(tag) || tag === 'component'

const rendersText = (node: Node, icons: Set<string>): boolean => {
	if (node.type === TEXT) return !!node.content?.trim()
	if (node.type === INTERPOLATION) return true
	if (node.type !== ELEMENT) return false
	if (isIcon(node, icons)) return false
	if (node.tag === 'slot' || isComponentTag(node.tag!)) return true
	if (node.props?.some((p) => TEXT_DIRECTIVES.has(p.name))) return true
	return (node.children ?? []).some((c) => rendersText(c, icons))
}

function isIcon(node: Node, icons: Set<string>) {
	if (classText(node).includes('lucide-')) return true
	if (icons.has(node.tag!)) return true
	if (node.tag !== 'component') return false
	const is = node.props?.find((p) => p.arg?.content === 'is')?.exp?.content
	const refs = is?.match(/\b[A-Z]\w*|\b\w+(?=\[)/g) ?? []
	return refs.length > 0 && refs.every((r) => icons.has(r))
}

// Each ink-gray-5 in a file that is not on a text-free template element.
const textUses = (source: string) => {
	const icons = iconImports(source)
	const found: string[] = []
	let placed = 0
	const walk = (node: Node) => {
		if (node.type !== ELEMENT) return
		const hits = classText(node).match(CLASS)?.length ?? 0
		placed += hits
		if (hits && rendersText(node, icons)) found.push(`<${node.tag}>`)
		node.children?.forEach(walk)
	}
	if (source.includes('<template')) {
		const ast = parse(source).descriptor.template?.ast as Node | undefined
		ast?.children?.forEach(walk)
	}
	const total = source.match(CLASS)?.length ?? 0
	for (let i = placed; i < total; i++) found.push('outside a template class')
	return found
}

const sources = (readdirSync(SRC, { recursive: true }) as string[])
	.filter((f) => /\.(vue|ts|js)$/.test(f) && !f.startsWith('tests/'))
	.sort()

describe('text-ink-gray-5 contrast ratchet', () => {
	// Guards: secondary text under AA contrast, in templates and the block
	// editor's text colours. Introduced across many PRs; test added with the
	// a11y audit remediation.
	const sfc = (template: string) =>
		`<template>${template}</template>\n<script setup>\nimport { Users } from 'lucide-vue-next'\n</script>`

	it.each([
		[sfc('<span class="text-ink-gray-5">{{ n }}</span>'), ['<span>']],
		[sfc('<Button class="text-ink-gray-5" :label="x" />'), ['<Button>']],
		[
			`<script>const c = 'text-ink-gray-5'</script>`,
			['outside a template class'],
		],
		[sfc('<span class="lucide-search text-ink-gray-5" />'), []],
		[sfc('<Users class="size-4 text-ink-gray-5" />'), []],
	])('the checker reads %s as %j', (source, expected) => {
		expect(textUses(source)).toEqual(expected)
	})

	it('uses ink-gray-5 only on icons', () => {
		expect(sources).toContain('components/Quiz.vue')
		const offenders = sources.flatMap((f) =>
			textUses(readFileSync(join(SRC, f), 'utf8')).map((u) => `${f} ${u}`)
		)
		expect(offenders).toEqual([])
		const css = readFileSync(join(SRC, 'styles/blockEditor.css'), 'utf8')
		expect(css).not.toMatch(
			/(secondary:|found-message \{\s*color:)\s*var\(--ink-gray-5/
		)
	})
})
