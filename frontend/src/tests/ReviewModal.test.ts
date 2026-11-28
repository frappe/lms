/**
 * ReviewModal.vue: submit behavior.
 *
 * Guards: (1) a missing rating must keep the dialog OPEN and surface the error
 * (the old code called close() unconditionally, so the modal vanished on a
 * validation failure and the user lost their input); (2) the 0–5 Rating is
 * scaled to the stored 0–1 range; (3) the member's own review is edited in place.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewModal from '@/components/Modals/ReviewModal.vue'

// hoisted so the vi.mock factory (which runs at import time) can reference it
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
// captured per url so the test can inspect each resource's makeParams()
const resourceConfigs: Record<
	string,
	{ makeParams: () => Record<string, any> }
> = {}

// Dialog stub turns each action into a button whose close() emits
// update:open=false. Real submitResource runs validate(); stubbed submit only
// routes to onError/onSuccess, so no network call.
vi.mock('frappe-ui', () => ({
	Dialog: {
		props: ['open', 'title', 'size', 'actions'],
		emits: ['update:open'],
		methods: {
			runAction(a: { onClick: (ctx: { close: () => void }) => void }) {
				a.onClick({ close: () => (this as any).$emit('update:open', false) })
			},
		},
		template: `<div><slot />
			<button
				v-for="a in actions"
				:key="a.label"
				data-testid="action"
				@click="runAction(a)"
			>{{ a.label }}</button>
		</div>`,
	},
	Rating: {
		props: ['modelValue', 'label'],
		emits: ['update:modelValue'],
		template: `<input data-testid="rating" :value="modelValue"
			@input="$emit('update:modelValue', Number($event.target.value))" />`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'rows'],
		emits: ['update:modelValue'],
		template: `<textarea data-testid="review" :value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)" />`,
	},
	toast: { error: toastError },
	createResource: (cfg: {
		url: string
		makeParams: () => Record<string, any>
	}) => {
		resourceConfigs[cfg.url] = cfg
		return {
			submit: (
				_values: unknown,
				opts: {
					onError?: (e: unknown) => void
					onSuccess?: () => void
				}
			) => {
				opts.onSuccess?.()
			},
		}
	},
}))

vi.stubGlobal('__', (s: string) => s)

const mountModal = (props: Record<string, unknown> = {}) =>
	mount(ReviewModal, {
		props: {
			modelValue: true,
			courseName: 'C1',
			...props,
		},
		global: { mocks: { __: (s: string) => s } },
	})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('ReviewModal submit', () => {
	it('keeps the dialog open and shows an error when the rating is missing', async () => {
		const wrapper = mountModal()
		await wrapper.get('[data-testid="action"]').trigger('click')

		expect(toastError).toHaveBeenCalledWith('Please enter a rating.')
		// close() must NOT have fired; the modal stays open so input isn't lost
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(wrapper.emitted('saved')).toBeUndefined()
	})

	it('scales the 0–5 rating to the stored 0–1 range', async () => {
		const wrapper = mountModal()
		await wrapper.get('[data-testid="rating"]').setValue('5')
		await wrapper.get('[data-testid="review"]').setValue('Great course')
		await wrapper.get('[data-testid="action"]').trigger('click')

		const doc = resourceConfigs['frappe.client.insert'].makeParams().doc
		expect(doc.rating).toBe(1)
		expect(doc.review).toBe('Great course')
		expect(doc.course).toBe('C1')
		expect(doc.doctype).toBe('LMS Course Review')
		expect(wrapper.emitted('saved')).toHaveLength(1)
	})

	it("opens with the member's own review and saves it in place", async () => {
		const wrapper = mountModal({
			ownReview: { name: 'REV-1', rating: 0.6, review: 'Good' },
		})
		expect(
			(wrapper.get('[data-testid="review"]').element as HTMLTextAreaElement)
				.value
		).toBe('Good')
		await wrapper.get('[data-testid="rating"]').setValue('4')
		await wrapper.get('[data-testid="action"]').trigger('click')

		expect(resourceConfigs['frappe.client.set_value'].makeParams()).toEqual({
			doctype: 'LMS Course Review',
			name: 'REV-1',
			fieldname: { review: 'Good', rating: 0.8 },
		})
		expect(wrapper.get('[data-testid="action"]').text()).toBe('Save')
	})
})
