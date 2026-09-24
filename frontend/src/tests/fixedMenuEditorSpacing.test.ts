// rc.1 <Editor> is renderless, so a fixedMenu RichTextEditor's toolbar and
// content box are children of its parent. A `space-y-*` parent splits them.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'vue/compiler-sfc'

// @vue/compiler-core NodeTypes
const ELEMENT = 1
const ATTRIBUTE = 6
const DIRECTIVE = 7

type Prop = {
	type: number
	name: string
	value?: { content: string }
	arg?: { content?: string }
}
type Node = {
	type: number
	tag?: string
	props?: Prop[]
	children?: Node[]
	loc: { start: { line: number } }
}

const SRC = join(__dirname, '..')

const FILES = [
	'components/Assignment.vue',
	'components/Modals/DiscussionModal.vue',
	'pages/Forms/ProfileEditForm.vue',
	'pages/JobApplications.vue',
]

const FIXED_MENU = /^fixed-?menu$/i

const staticClass = (el: Node) =>
	el.props?.find((p) => p.type === ATTRIBUTE && p.name === 'class')?.value
		?.content ?? ''

const hasFixedMenu = (el: Node) =>
	(el.props ?? []).some(
		(p) =>
			(p.type === ATTRIBUTE && FIXED_MENU.test(p.name)) ||
			(p.type === DIRECTIVE && FIXED_MENU.test(p.arg?.content ?? ''))
	)

const offenders = (children: Node[], parent?: Node): number[] =>
	children.flatMap((node) => {
		if (node.type !== ELEMENT) return []
		const own =
			node.tag === 'RichTextEditor' &&
			hasFixedMenu(node) &&
			parent &&
			/\bspace-y-/.test(staticClass(parent))
				? [node.loc.start.line]
				: []
		return [...own, ...offenders(node.children ?? [], node)]
	})

describe('fixedMenu RichTextEditor parents', () => {
	it('carry no space-y spacing', () => {
		const found = FILES.flatMap((file) => {
			const source = readFileSync(join(SRC, file), 'utf8')
			const ast = parse(source).descriptor.template?.ast as Node | undefined
			return offenders(ast?.children ?? []).map((line) => `${file}:${line}`)
		})
		expect(found).toEqual([])
	})
})
