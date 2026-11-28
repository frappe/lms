/** AssessmentAuthors.vue, the read-only authors on the submission screens. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { AssessmentAuthorsInfo } from '@/types'

const { server, reloads } = vi.hoisted(() => ({
	server: { info: null as AssessmentAuthorsInfo | null },
	reloads: [] as Record<string, unknown>[],
}))

vi.mock('frappe-ui', async () => {
	const { defineComponent, h, reactive } = await import('vue')
	return {
		Avatar: defineComponent({
			props: ['image', 'label', 'size'],
			setup: (p) => () =>
				h('span', { 'data-avatar': p.label, 'data-image': p.image }),
		}),
		createResource: (options: {
			makeParams: () => Record<string, unknown>
		}) => {
			const resource = reactive({
				data: null as AssessmentAuthorsInfo | null,
				reload: vi.fn(() => {
					reloads.push(options.makeParams())
					resource.data = server.info
				}),
			})
			return resource
		},
	}
})

import AssessmentAuthors from '@/components/Assessment/AssessmentAuthors.vue'

enableAutoUnmount(afterEach)

const AUTHORS = [
	{ name: 'ann@x.io', full_name: 'Ann Author', user_image: '/files/ann.png' },
	{ name: 'cal@x.io', full_name: 'Cal Coauthor', user_image: null },
]

const mountAuthors = (
	name: string | null,
	userData: Record<string, unknown> = { is_instructor: true }
) =>
	mount(AssessmentAuthors, {
		props: { doctype: 'LMS Assignment', name },
		global: {
			mocks: { __: (text: string) => text },
			provide: { $user: reactive({ data: { name: 'me@x.io', ...userData } }) },
		},
	})

beforeEach(() => {
	server.info = { authors: AUTHORS, can_edit: false }
	reloads.length = 0
})

describe('AssessmentAuthors', () => {
	it.each([
		{ role: 'is_instructor' },
		{ role: 'is_moderator' },
		{ role: 'is_evaluator' },
	])(
		'shows a reviewer ($role) every author by name and avatar',
		async ({ role }) => {
			const wrapper = mountAuthors('asg-1', { [role]: true })
			await flushPromises()

			expect(reloads).toEqual([{ doctype: 'LMS Assignment', name: 'asg-1' }])
			const group = wrapper.get('[data-testid="assessment-authors"]')
			expect(group.attributes('role')).toBe('group')
			expect(group.attributes('aria-label')).toBe('Authors')
			expect(group.text()).toBe('Ann Author, Cal Coauthor')
			expect(
				wrapper.findAll('[data-avatar]').map((a) => a.attributes('data-avatar'))
			).toEqual(['Ann Author', 'Cal Coauthor'])
			expect(wrapper.find('[data-avatar]').attributes('data-image')).toBe(
				'/files/ann.png'
			)
		}
	)

	it('asks nothing and shows nothing to a learner', async () => {
		const wrapper = mountAuthors('asg-1', { is_student: true })
		await flushPromises()

		expect(reloads).toHaveLength(0)
		expect(wrapper.find('[data-testid="assessment-authors"]').exists()).toBe(
			false
		)
	})

	it('waits for an assessment to be chosen', async () => {
		const wrapper = mountAuthors(null)
		await flushPromises()

		expect(reloads).toHaveLength(0)
		expect(wrapper.find('[data-testid="assessment-authors"]').exists()).toBe(
			false
		)
	})

	it('follows the assessment it is pointed at', async () => {
		const wrapper = mountAuthors('asg-1')
		await flushPromises()
		await wrapper.setProps({ name: 'asg-2' })
		await flushPromises()

		expect(reloads.at(-1)).toEqual({ doctype: 'LMS Assignment', name: 'asg-2' })
	})
})
