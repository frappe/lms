import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

const { marker } = vi.hoisted(() => ({
	marker: (text: string) => () => ({
		default: { inheritAttrs: false, template: `<span>${text}</span>` },
	}),
}))

vi.mock('@/utils', () => ({ createLMSCategory: vi.fn() }))
vi.mock('@/components/Controls/Link.vue', marker('CATEGORY PICKER'))
vi.mock('@/components/InlineEdit/InlineText.vue', () => ({
	default: {
		props: ['modelValue', 'placeholder', 'missing'],
		template: `<input :value="modelValue" :placeholder="placeholder" :data-missing="String(Boolean(missing))" />`,
	},
}))
vi.mock(
	'@/components/InlineEdit/InstructorsField.vue',
	marker('INSTRUCTOR PICKER')
)
vi.mock('@/components/CourseInstructors.vue', marker('INSTRUCTOR NAMES'))
vi.mock('@/components/UserAvatar.vue', marker(''))

import BatchHeading from '@/pages/Batches/components/overview/BatchHeading.vue'

const form = (missing: string[] = []) => ({
	instructors: ref(['ash@example.com']),
	isMissing: (key: string) => missing.includes(key),
})

const mountHeading = (props: Record<string, unknown>) =>
	mount(BatchHeading, {
		props: {
			batch: {
				title: 'Spring batch',
				description: 'For new consultants',
				instructors: [{ username: 'ash', full_name: 'Ash' }],
				...(props.batch as object),
			},
			doc: props.doc ?? null,
			form: props.form ?? null,
		},
		global: { mocks: { __: (text: string) => text } },
	})

describe('the batch heading', () => {
	it('reads as plain text to a learner', () => {
		const wrapper = mountHeading({})
		expect(wrapper.find('h1').text()).toBe('Spring batch')
		expect(wrapper.find('input').exists()).toBe(false)
		expect(wrapper.text()).toContain('INSTRUCTOR NAMES')
	})

	it('edits title and description in place for an instructor', () => {
		const doc = { title: 'Spring batch', description: '' }
		const wrapper = mountHeading({
			doc,
			form: form(['description']),
			batch: { can_change_instructors: true },
		})
		const [title, description] = wrapper.findAll('input')
		expect(title.element.value).toBe('Spring batch')
		expect(description.attributes('data-missing')).toBe('true')
		expect(wrapper.text()).toContain('INSTRUCTOR PICKER')
	})

	// The learner's paragraph is text-base; the field's padding is pulled out
	// so the text sits where the learner's does.
	it('sets the description at the learner text size and position', () => {
		const wrapper = mountHeading({ doc: { description: 'x' }, form: form() })
		const description = wrapper.findAll('input')[1]
		expect(description.classes()).toEqual(
			expect.arrayContaining(['text-base', 'leading-6', '-my-[7px]'])
		)
	})

	// The server refuses instructor changes from a tagged evaluator.
	it('keeps instructors read-only for an evaluator who is not an instructor', () => {
		const wrapper = mountHeading({
			doc: { title: 'Spring batch', description: 'x' },
			form: form(),
			batch: { can_change_instructors: false },
		})
		expect(wrapper.text()).not.toContain('INSTRUCTOR PICKER')
		expect(wrapper.text()).toContain('INSTRUCTOR NAMES')
	})
})
