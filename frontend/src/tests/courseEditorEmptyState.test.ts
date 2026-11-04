import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'

vi.stubGlobal('__', (text: string) => text)
if (!('format' in String.prototype)) {
	// eslint-disable-next-line no-extend-native
	Object.defineProperty(String.prototype, 'format', {
		value: function (...args: string[]) {
			return this.replace(/\{(\d+)\}/g, (_: string, i: number) => args[i] ?? '')
		},
	})
}

const capture = vi.fn()
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture }),
}))

vi.mock('frappe-ui', () => ({
	// Like the real one: an href turns the button into a link.
	Button: {
		name: 'Button',
		props: ['label', 'variant', 'href'],
		emits: ['click'],
		render() {
			return h(
				this.href ? 'a' : 'button',
				{ href: this.href, onClick: () => this.$emit('click') },
				this.label
			)
		},
	},
}))

import CourseEditorEmptyState from '@/components/CourseEditorEmptyState.vue'

const SOURCE = 'course_editor_empty_state'

const chapter = (name: string, lessons: string[] = []) => ({
	name,
	title: name,
	lessons: lessons.map((lesson) => ({ name: lesson, title: lesson })),
})

const mountEmpty = (chapters: unknown[], isMobile = false) =>
	mount(CourseEditorEmptyState, {
		props: { courseName: 'marketing-101', chapters, isMobile },
		global: { mocks: { __: (text: string) => text } },
	})

const stepStates = (wrapper: ReturnType<typeof mountEmpty>) =>
	wrapper.findAll('li').map((li) => {
		if (li.find('.lucide-circle-check').exists()) return 'done'
		return li.attributes('aria-current') === 'step' ? 'current' : 'open'
	})

beforeEach(() => capture.mockClear())

describe('CourseEditorEmptyState', () => {
	it('asks for a chapter first when the course has none', async () => {
		const wrapper = mountEmpty([])

		expect(wrapper.get('h2').text()).toBe('Start building your course')
		expect(stepStates(wrapper)).toEqual(['current', 'open', 'open'])
		expect(wrapper.get('a').attributes('href')).toContain('/add-a-chapter')
		await wrapper.get('button').trigger('click')
		expect(wrapper.emitted('create-chapter')).toEqual([[SOURCE]])
	})

	it('asks for a lesson in the first chapter once a chapter exists', async () => {
		const first = chapter('Introduction')
		const wrapper = mountEmpty([first, chapter('Basics')])

		expect(wrapper.get('h2').text()).toBe('Add your first lesson')
		expect(wrapper.get('p').text()).toContain('“Introduction”')
		expect(stepStates(wrapper)).toEqual(['done', 'current', 'open'])
		expect(wrapper.get('a').attributes('href')).toContain('/adding-a-lesson')
		await wrapper.get('button').trigger('click')
		expect(wrapper.emitted('add-lesson')).toEqual([
			[{ chapter: first, source: SOURCE }],
		])
	})

	it('offers a new lesson in the last chapter once lessons exist', async () => {
		const last = chapter('Basics')
		const wrapper = mountEmpty([chapter('Introduction', ['Hello']), last])

		expect(wrapper.get('h2').text()).toBe('Pick a lesson to edit')
		// Orientation steps are for an empty course only.
		expect(wrapper.find('ol').exists()).toBe(false)
		expect(wrapper.get('a').attributes('href')).toContain('/adding-a-lesson')
		await wrapper.get('button').trigger('click')
		expect(wrapper.emitted('add-lesson')).toEqual([
			[{ chapter: last, source: SOURCE }],
		])
	})

	it('points at the chapters sheet on a phone, where there is no panel', () => {
		const chapters = [chapter('Introduction', ['Hello'])]

		expect(mountEmpty(chapters).get('p').text()).toContain('chapters panel')
		expect(mountEmpty(chapters, true).get('p').text()).toContain('below')
	})

	it('reports each state it shows, the action taken and the docs opened', async () => {
		const wrapper = mountEmpty([])
		expect(capture).toHaveBeenCalledWith('course_editor_empty_state_shown', {
			course: 'marketing-101',
			state: 'no_chapters',
		})

		await wrapper.get('button').trigger('click')
		expect(capture).toHaveBeenCalledWith('course_editor_empty_state_action', {
			course: 'marketing-101',
			state: 'no_chapters',
			action: 'create_chapter',
		})

		await wrapper.get('a').trigger('click')
		expect(capture).toHaveBeenCalledWith(
			'course_editor_empty_state_docs_opened',
			{ course: 'marketing-101', state: 'no_chapters' }
		)

		// The chapter arrives: a new state, reported once more.
		await wrapper.setProps({ chapters: [chapter('Introduction')] })
		expect(capture).toHaveBeenLastCalledWith(
			'course_editor_empty_state_shown',
			{ course: 'marketing-101', state: 'no_lessons' }
		)
	})
})
