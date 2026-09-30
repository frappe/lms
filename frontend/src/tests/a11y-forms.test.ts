import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'vue/compiler-sfc'
import { mount } from '@vue/test-utils'
import RichTextEditor from '@/components/RichTextEditor.vue'
import Link from '@/components/Controls/Link.vue'
import ClearableCombobox from '@/components/Controls/ClearableCombobox.vue'

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ isSettingsOpen: false }),
}))

const ELEMENT = 1
const ATTRIBUTE = 6
const DIRECTIVE = 7

type Prop = {
	type: number
	name: string
	value?: { content: string }
	arg?: { content?: string }
	exp?: { content: string }
}
type Node = {
	type: number
	tag?: string
	props?: Prop[]
	children?: Node[]
	loc: { start: { line: number } }
}

const SRC = join(__dirname, '..')
const read = (file: string) => readFileSync(join(SRC, file), 'utf8')

const elements = (file: string): Node[] => {
	const ast = parse(read(file)).descriptor.template?.ast as Node | undefined
	const walk = (nodes: Node[]): Node[] =>
		nodes.flatMap((n) =>
			n.type === ELEMENT ? [n, ...walk(n.children ?? [])] : []
		)
	return walk(ast?.children ?? [])
}

const norm = (name: string) => name.replace(/-/g, '').toLowerCase()

const attr = (el: Node, name: string): string | undefined => {
	const prop = (el.props ?? []).find(
		(p) =>
			(p.type === ATTRIBUTE && norm(p.name) === norm(name)) ||
			(p.type === DIRECTIVE &&
				p.name === 'bind' &&
				norm(p.arg?.content ?? '') === norm(name))
	)
	if (!prop) return undefined
	return prop.type === ATTRIBUTE ? prop.value?.content ?? '' : prop.exp?.content
}

const boundIds = (file: string) =>
	new Set(elements(file).map((el) => attr(el, 'id')))

const idsIn = (expr: string) =>
	expr.match(/[A-Za-z_$][\w$]*(?:Id|LabelId)\b/g) ?? []

const expectIdsDeclared = (file: string, labelledby: string) => {
	const ids = idsIn(labelledby)
	expect(ids.length).toBeGreaterThan(0)
	const declared = [...boundIds(file)].flatMap((expr) => idsIn(expr ?? ''))
	for (const id of ids) expect(declared).toContain(id)
}

const EDITOR_FILES = [
	'components/Notes/Notes.vue',
	'components/DiscussionReplies.vue',
	'pages/Forms/NewCourseForm.vue',
	'pages/Forms/NewBatchForm.vue',
	'pages/Batches/BatchForm.vue',
	'components/Courses/CourseOverviewSection.vue',
	'pages/Forms/JobForm.vue',
	'pages/Forms/EmailTemplateForm.vue',
	'components/ContactUsEmail.vue',
]

const mocks = { __: (s: string) => s }

describe('rich text editors', () => {
	// Guards: unnamed rich text editors with no focus ring. Introduced in #2565
	// and #2662; test added with the a11y audit remediation.
	it.each(EDITOR_FILES)('%s names every editor', (file) => {
		const editors = elements(file).filter((el) => el.tag === 'RichTextEditor')
		expect(editors.length).toBeGreaterThan(0)
		for (const el of editors) {
			const label = attr(el, 'ariaLabel')
			if (label) expect(label).toMatch(/__\('.+'\)/)
			else expectIdsDeclared(file, attr(el, 'ariaLabelledby') ?? '')
		}
	})

	it('puts its name and a focus ring on the tiptap textbox', () => {
		document.elementFromPoint ??= () => null
		const w = mount(RichTextEditor, {
			props: { ariaLabel: 'Your reply', content: '' },
		})
		const box = w.get('[role="textbox"]')
		expect(box.attributes('aria-label')).toBe('Your reply')
		expect(box.classes()).toContain('focus-visible:ring-2')
		w.unmount()
	})
})

const FILTERS: Array<[string, string, string]> = [
	['pages/Jobs.vue', 'Link', 'Country'],
	['pages/Jobs.vue', 'Select', 'Type'],
	['pages/Jobs.vue', 'Select', 'Work Mode'],
	['pages/Assignments.vue', 'Select', 'Type'],
	['pages/QuizSubmissions.vue', 'Link', 'Filter by Quiz'],
	['pages/QuizSubmissions.vue', 'Link', 'Filter by Member'],
	['pages/QuizSubmissions.vue', 'Link', 'Filter by Course'],
	['pages/ProgrammingExercises/ProgrammingExercises.vue', 'Select', 'Type'],
	['pages/Courses/CourseDashboard.vue', 'Select', 'Sort by'],
	['components/Programs/ProgramProgressSummary.vue', 'FormControl', 'Search'],
	['pages/Courses/Courses.vue', 'ClearableCombobox', 'Category'],
	['pages/Batches/Batches.vue', 'ClearableCombobox', 'Category'],
	['pages/CertifiedParticipants.vue', 'ClearableCombobox', 'Category'],
]

describe('placeholder-only filters', () => {
	// Guards: filters named only by a placeholder. Introduced in #1223, #1464,
	// #1593, #1739, #2015, #2502, #2662 and #2710; test added with the a11y
	// audit remediation.
	it.each(FILTERS)('%s %s "%s" has an aria-label', (file, tag, text) => {
		const el = elements(file).find(
			(e) => e.tag === tag && attr(e, 'placeholder') === `__('${text}')`
		)
		expect(attr(el!, 'aria-label')).toBe(`__('${text}')`)
	})

	it('ClearableCombobox puts its ariaLabel on the input', () => {
		const w = mount(ClearableCombobox, {
			props: { modelValue: null, options: [], ariaLabel: 'Category' },
			global: { mocks },
		})
		expect(w.find('input').attributes('aria-label')).toBe('Category')
		w.unmount()
	})
})

describe('named controls and focus outlines', () => {
	// Guards: unnamed lesson preview switches, marks input and tags trigger, no
	// JobForm h1, and lost focus outlines. Introduced in #2164, #2469, #2659 and
	// #2662; test added with the a11y audit remediation.
	it('names the lesson preview switches and rings the title', () => {
		const file = 'pages/LessonForm.vue'
		const switches = elements(file).filter((el) => el.tag === 'Switch')
		expect(switches).toHaveLength(2)
		for (const sw of switches)
			expectIdsDeclared(file, attr(sw, 'aria-labelledby') ?? '')
		const title = elements(file).find((el) => el.tag === 'textarea')!
		expect(attr(title, 'class')).toMatch(/\bfocus-visible:ring-2\b/)
	})

	it('names the marks input and tags trigger, and gives JobForm an h1', () => {
		const marks = elements('pages/QuizSubmission.vue').find(
			(e) => e.tag === 'FormControl' && attr(e, 'type') === 'number'
		)!
		expect(attr(marks, 'aria-label')).toContain("__('Marks for question {0}')")
		const file = 'components/Courses/CourseDetailsSection.vue'
		const tags = elements(file).find((el) => el.tag === 'button')!
		expectIdsDeclared(file, attr(tags, 'aria-labelledby') ?? '')
		const h1 = elements('pages/Forms/JobForm.vue').find((e) => e.tag === 'h1')!
		expect(attr(h1, 'class')).toContain('sr-only')
	})

	it('outlines the code box inputs on focus', () => {
		const css = read('styles/blockEditor.css')
		for (const cls of ['codeBoxTextArea', 'codeBoxSelectInput'])
			expect(css).toMatch(
				new RegExp(
					`\\.${cls}:focus-visible[^{]*\\{[^}]*outline:\\s*2px solid var\\(--outline-gray-5\\)`
				)
			)
	})
})

describe('autocomplete tokens', () => {
	// Guards: billing and sign-up fields without autocomplete tokens, and
	// untranslated sign-up labels. Introduced in #713; test added with the a11y
	// audit remediation.
	it.each([
		['Billing Name', 'name'],
		['Address Line 1', 'address-line1'],
		['Address Line 2', 'address-line2'],
		['City', 'address-level2'],
		['State/Province', 'address-level1'],
		['Country', 'country-name'],
		['Postal Code', 'postal-code'],
		['Phone Number', 'tel'],
	])('Billing %s fields use %s', (label, token) => {
		const fields = elements('pages/Billing.vue').filter(
			(e) => attr(e, 'label') === `__('${label}')`
		)
		expect(fields.length).toBeGreaterThan(0)
		for (const f of fields) expect(attr(f, 'autocomplete')).toBe(token)
	})

	it('Link forwards autocomplete to the combobox input', () => {
		const w = mount(Link, {
			props: { doctype: 'Country', label: 'Country' },
			attrs: { autocomplete: 'country-name' },
			global: { mocks },
		})
		expect(w.find('input').attributes('autocomplete')).toBe('country-name')
		w.unmount()
	})

	it('new-sign-up.html tokens its inputs and translates its labels', () => {
		const html = read('../../lms/www/new-sign-up.html')
		for (const [id, token] of [
			['full_name', 'name'],
			['signup_email', 'email'],
			['username', 'username'],
			['password', 'new-password'],
		])
			expect(html).toMatch(
				new RegExp(`<input id="${id}"[^>]*autocomplete="${token}"`)
			)
		const labels = [...html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)]
		expect(labels).toHaveLength(5)
		for (const [, text] of labels) expect(text).toMatch(/^\{\{ _\(".+"\) \}\}/)
	})
})
