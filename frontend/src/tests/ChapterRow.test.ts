import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChapterRow from '@/components/ChapterRow.vue'
import type { OutlineChapter } from '@/types'

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: {} }),
	useRouter: () => ({ push: pushMock }),
}))

vi.mock('frappe-ui', () => ({
	Button: {
		template: `<button><slot name="prefix" /><slot /></button>`,
	},
	TextInput: {
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template: `
			<div>
				<input
					:value="modelValue"
					@input="$emit('update:modelValue', $event.target.value)"
				/>
			</div>
		`,
	},
	Tooltip: {
		template: `<span><slot /></span>`,
	},
	toast: {
		success: vi.fn(),
	},
}))

vi.mock('vuedraggable', () => ({
	default: {
		props: ['list'],
		template: `
			<div>
				<div v-for="item in list" :key="item.name">
					<slot name="item" :element="item" />
				</div>
			</div>
		`,
	},
}))

vi.stubGlobal('__', (s: string) => s)

const chapter: OutlineChapter = {
	name: 'CH-2',
	title: 'Old Chapter',
	idx: 2,
	is_scorm_package: 0 as const,
	lessons: [{ name: 'LESSON-1', title: 'Lesson 1', number: '2-1' }],
}

const mountRow = (chapterOverride: OutlineChapter = chapter) =>
	mount(ChapterRow, {
		props: {
			chapter: chapterOverride,
			index: 1,
			courseName: 'course-1',
			allowEdit: true,
		},
		global: {
			mocks: { __: (s: string) => s },
			provide: { $user: { data: { name: 'admin@example.com' } } },
			stubs: {
				'router-link': { template: '<a><slot /></a>' },
			},
		},
	})

beforeEach(() => {
	pushMock.mockReset()
})

describe('ChapterRow inline rename', () => {
	it('commits on Enter without toggling the chapter disclosure', async () => {
		const wrapper = mountRow()

		expect(wrapper.text()).not.toContain('Lesson 1')
		await wrapper.get('[title="Old Chapter"]').trigger('dblclick')

		const input = wrapper.get('input')
		await input.setValue('Renamed Chapter')
		await input.trigger('keydown.enter')

		expect(wrapper.emitted('rename-chapter')?.[0]).toMatchObject([
			{ chapter, title: 'Renamed Chapter' },
		])
		expect(wrapper.text()).not.toContain('Lesson 1')
	})
})

describe('ChapterRow locked lesson', () => {
	it('renders a lock and no router-link for a locked lesson', () => {
		const wrapper = mountRow({
			...chapter,
			idx: 1,
			lessons: [
				{ name: 'LESSON-1', title: 'Lesson 1', number: '2-1', locked: 1 },
			],
		})

		expect(wrapper.find('.lucide-lock-keyhole').exists()).toBe(true)
		expect(wrapper.find('a').exists()).toBe(false)
	})

	// The locked row is a plain <div> (implicit role="generic"), and ARIA
	// prohibits naming a generic element, so `aria-label` on it is not
	// guaranteed to reach a screen reader. The state travels as real text
	// instead, which is exposed whatever the role, and the icon is hidden so
	// it is not announced twice.
	it('exposes the locked state as text, not as aria-label on a div', () => {
		const wrapper = mountRow({
			...chapter,
			idx: 1,
			lessons: [
				{ name: 'LESSON-1', title: 'Lesson 1', number: '2-1', locked: 1 },
			],
		})

		const row = wrapper.get('.cursor-not-allowed')
		expect(row.attributes('aria-label')).toBeUndefined()
		expect(row.attributes('aria-disabled')).toBeUndefined()
		expect(row.get('.sr-only').text()).toBe('Locked')
		expect(row.text()).toContain('Lesson 1')

		const lock = wrapper.get('.lucide-lock-keyhole')
		expect(lock.attributes('aria-hidden')).toBe('true')
	})

	it('still links an unlocked lesson', () => {
		const wrapper = mountRow({
			...chapter,
			idx: 1,
			lessons: [
				{ name: 'LESSON-1', title: 'Lesson 1', number: '2-1', locked: 0 },
			],
		})

		expect(wrapper.find('a').exists()).toBe(true)
		expect(wrapper.find('.lucide-lock-keyhole').exists()).toBe(false)
		expect(wrapper.text()).not.toContain('Locked')
	})

	// A SCORM chapter renders no DisclosurePanel, so it never reaches the per-lesson
	// lock affordance above: it used to look identical to an open chapter, and the
	// student learned it was locked only after SCORMChapter.vue bounced them back.
	const scormChapter = (locked: 0 | 1): OutlineChapter => ({
		...chapter,
		idx: 1,
		is_scorm_package: 1 as const,
		lessons: [
			{ name: 'LESSON-1', title: 'SCORM Lesson', number: '1-1', locked },
		],
	})

	it('marks a locked SCORM chapter and refuses to open it', async () => {
		const wrapper = mountRow(scormChapter(1))

		const lock = wrapper.get('.lucide-lock-keyhole')
		expect(lock.attributes('aria-hidden')).toBe('true')
		expect(wrapper.get('.sr-only').text()).toBe('Locked')

		await wrapper.get('[title="Old Chapter"]').trigger('click')
		expect(pushMock).not.toHaveBeenCalled()
	})

	it('still opens an unlocked SCORM chapter', async () => {
		const wrapper = mountRow(scormChapter(0))

		expect(wrapper.find('.lucide-lock-keyhole').exists()).toBe(false)

		await wrapper.get('[title="Old Chapter"]').trigger('click')
		expect(pushMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'SCORMChapter',
				params: { courseName: 'course-1', chapterName: 'CH-2' },
			})
		)
	})

	it('does not emit select-lesson when a locked inline row is clicked', async () => {
		const wrapper = mount(ChapterRow, {
			props: {
				chapter: {
					...chapter,
					idx: 1,
					lessons: [
						{
							name: 'LESSON-1',
							title: 'Lesson 1',
							number: '2-1',
							locked: 1,
						},
					],
				},
				index: 1,
				courseName: 'course-1',
				inlineSelect: true,
			},
			global: {
				mocks: { __: (s: string) => s },
				provide: { $user: { data: { name: 'admin@example.com' } } },
			},
		})

		await wrapper.get('.cursor-not-allowed').trigger('click')

		expect(wrapper.emitted('select-lesson')).toBeUndefined()
	})
})
