import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChapterRow from '@/components/ChapterRow.vue'

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

const chapter = {
	name: 'CH-2',
	title: 'Old Chapter',
	idx: 2,
	is_scorm_package: 0 as const,
	lessons: [{ name: 'LESSON-1', title: 'Lesson 1', number: '2-1' }],
}

const mountRow = () =>
	mount(ChapterRow, {
		props: {
			chapter,
			index: 1,
			courseName: 'course-1',
			allowEdit: true,
		},
		global: {
			mocks: { __: (s: string) => s },
			provide: { $user: { data: { name: 'admin@example.com' } } },
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
