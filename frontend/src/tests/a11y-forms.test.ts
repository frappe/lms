import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'vue/compiler-sfc'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { FormControl, Switch } from 'frappe-ui'
import Select from '@/components/Controls/Select.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'

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

describe('rich text editors', () => {
	const editors = EDITOR_FILES.flatMap((file) =>
		elements(file)
			.filter((el) => el.tag === 'RichTextEditor')
			.map((el) => ({ file, line: el.loc.start.line, el }))
	)

	it('finds an editor in every listed file', () => {
		const files = new Set(editors.map((e) => e.file))
		expect([...files].sort()).toEqual([...EDITOR_FILES].sort())
	})

	it.each(editors.map((e) => ({ at: `${e.file}:${e.line}`, ...e })))(
		'$at has an accessible name',
		({ file, el }) => {
			const label = attr(el, 'ariaLabel')
			if (label) return expect(label).toMatch(/__\('.+'\)/)
			const labelledby = attr(el, 'ariaLabelledby')
			expect(labelledby).toBeTruthy()
			expectIdsDeclared(file, labelledby as string)
		}
	)

	it('forwards ariaLabelledby to the tiptap textbox', () => {
		document.elementFromPoint ??= () => null
		const w = mount(RichTextEditor, {
			props: { ariaLabelledby: 'label-x', content: '' },
		})
		const box = w.find('[role="textbox"]')
		expect(box.exists()).toBe(true)
		expect(box.attributes('aria-labelledby')).toBe('label-x')
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
]

describe('placeholder-only filters', () => {
	it.each(FILTERS.map(([file, tag, text]) => ({ file, tag, text })))(
		'$file $tag "$text" has an aria-label',
		({ file, tag, text }) => {
			const el = elements(file).find(
				(e) => e.tag === tag && attr(e, 'placeholder') === `__('${text}')`
			)
			expect(el).toBeTruthy()
			expect(attr(el as Node, 'aria-label')).toBe(`__('${text}')`)
		}
	)

	it('LMS Select puts aria-label on the trigger', () => {
		const w = mount(Select, {
			props: { options: [{ label: 'A', value: 'a' }], placeholder: 'Type' },
			attrs: { 'aria-label': 'Type' },
			global: { mocks: { __: (s: string) => s } },
		})
		expect(w.find('button').attributes('aria-label')).toBe('Type')
		w.unmount()
	})

	it('FormControl puts aria-label on the input', () => {
		const w = mount(FormControl, {
			props: { placeholder: 'Search' },
			attrs: { 'aria-label': 'Search' },
		})
		expect(w.find('input').attributes('aria-label')).toBe('Search')
		w.unmount()
	})
})

describe('LessonForm', () => {
	const file = 'pages/LessonForm.vue'

	it('names both preview switches from their visible text', () => {
		const switches = elements(file).filter((el) => el.tag === 'Switch')
		expect(switches).toHaveLength(2)
		for (const sw of switches) {
			const labelledby = attr(sw, 'aria-labelledby')
			expect(labelledby).toBeTruthy()
			expectIdsDeclared(file, labelledby as string)
		}
	})

	it('Switch forwards aria-labelledby to the switch control', () => {
		const w = mount(() =>
			h('div', [
				h('span', { id: 'sw-label' }, 'Include in preview'),
				h(Switch, { 'aria-labelledby': 'sw-label' }),
			])
		)
		expect(w.find('[role="switch"]').attributes('aria-labelledby')).toBe(
			'sw-label'
		)
		w.unmount()
	})

	it('title textarea replaces the removed focus outline', () => {
		const textarea = elements(file).find((el) => el.tag === 'textarea')
		const cls = attr(textarea as Node, 'class') ?? ''
		expect(cls).toMatch(/\bfocus-visible:ring-2\b/)
		expect(cls).toMatch(/\bfocus-visible:ring-outline-gray-5\b/)
	})
})

describe('blockEditor.css code box', () => {
	const css = read('styles/blockEditor.css')

	it.each(['codeBoxTextArea', 'codeBoxSelectInput'])(
		'.%s gets a focus-visible outline',
		(cls) => {
			const rule = css.match(
				new RegExp(`\\.${cls}:focus-visible[^{]*\\{([^}]*)\\}`)
			)
			expect(rule).toBeTruthy()
			expect(rule?.[1]).toMatch(/outline:\s*2px solid var\(--outline-gray-5\)/)
		}
	)
})

describe('single controls', () => {
	it('QuizSubmission marks input is named per question', () => {
		const el = elements('pages/QuizSubmission.vue').find(
			(e) => e.tag === 'FormControl' && attr(e, 'type') === 'number'
		)
		expect(attr(el as Node, 'aria-label')).toContain(
			"__('Marks for question {0}')"
		)
	})

	it('CourseDetailsSection tag trigger is labelled by the Tags label', () => {
		const file = 'components/Courses/CourseDetailsSection.vue'
		const button = elements(file).find((el) => el.tag === 'button')
		const labelledby = attr(button as Node, 'aria-labelledby') ?? ''
		expect(idsIn(labelledby)).toContain('tagsLabelId')
		expectIdsDeclared(file, labelledby)
	})

	it('JobForm has a visually hidden h1', () => {
		const h1 = elements('pages/Forms/JobForm.vue').find((e) => e.tag === 'h1')
		expect(h1).toBeTruthy()
		expect(attr(h1 as Node, 'class')).toContain('sr-only')
	})
})

const BILLING: Array<[string, string]> = [
	['Billing Name', 'name'],
	['Address Line 1', 'address-line1'],
	['Address Line 2', 'address-line2'],
	['City', 'address-level2'],
	['State/Province', 'address-level1'],
	['Postal Code', 'postal-code'],
	['Phone Number', 'tel'],
]

describe('Billing autocomplete', () => {
	const els = elements('pages/Billing.vue')

	it.each(BILLING.map(([label, token]) => ({ label, token })))(
		'$label fields use $token',
		({ label, token }) => {
			const fields = els.filter((e) => attr(e, 'label') === `__('${label}')`)
			expect(fields.length).toBeGreaterThan(0)
			for (const f of fields) expect(attr(f, 'autocomplete')).toBe(token)
		}
	)

	it('FormControl forwards autocomplete to the input', () => {
		const w = mount(FormControl, {
			props: { label: 'City' },
			attrs: { autocomplete: 'address-level2' },
		})
		expect(w.find('input').attributes('autocomplete')).toBe('address-level2')
		w.unmount()
	})
})

describe('new-sign-up.html', () => {
	const html = readFileSync(
		join(SRC, '..', '..', 'lms', 'www', 'new-sign-up.html'),
		'utf8'
	)

	it.each([
		['full_name', 'name'],
		['signup_email', 'email'],
		['username', 'username'],
		['password', 'new-password'],
	])('#%s has autocomplete=%s', (id, token) => {
		const input = html.match(new RegExp(`<input id="${id}"[^>]*>`))
		expect(input?.[0]).toContain(`autocomplete="${token}"`)
	})

	it('translates every label', () => {
		const labels = [...html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)]
		expect(labels.length).toBe(5)
		for (const [, text] of labels) expect(text).toMatch(/^\{\{ _\(".+"\) \}\}/)
	})
})
