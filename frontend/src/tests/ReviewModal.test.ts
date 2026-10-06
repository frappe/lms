/**
 * ReviewModal.vue: submit behavior.
 *
 * Guards: (1) a missing rating must keep the dialog OPEN and surface the error
 * (the old code called close() unconditionally, so the modal vanished on a
 * validation failure and the user lost their input); (2) the 0–5 Rating is
 * scaled to the stored 0–1 range; (3) a successful submit reloads the review
 * list + has-reviewed count and then closes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewModal from '@/components/Modals/ReviewModal.vue'

// hoisted so the vi.mock factory (which runs at import time) can reference it
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
// captured from the createResource() call so the test can inspect makeParams()
let resourceConfig: { makeParams: () => { doc: Record<string, unknown> } }
// when set, the stubbed submit fails the request with this error
let submitError: unknown = null

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
	createResource: (cfg: typeof resourceConfig) => {
		resourceConfig = cfg
		return {
			submit: (
				_values: unknown,
				opts: {
					onError?: (e: unknown) => void
					onSuccess?: () => void
				}
			) => {
				if (submitError) opts.onError?.(submitError)
				else opts.onSuccess?.()
			},
		}
	},
}))

vi.stubGlobal('__', (s: string) => s)

const reloadReviews = vi.fn()
const reloadHasReviewed = vi.fn()

const mountModal = () =>
	mount(ReviewModal, {
		props: {
			modelValue: true,
			reloadReviews: { reload: reloadReviews },
			hasReviewed: { reload: reloadHasReviewed },
			courseName: 'C1',
		},
		global: { mocks: { __: (s: string) => s } },
	})

beforeEach(() => {
	vi.clearAllMocks()
	submitError = null
})

describe('ReviewModal submit', () => {
	it('keeps the dialog open and shows an error when the rating is missing', async () => {
		const wrapper = mountModal()
		await wrapper.get('[data-testid="action"]').trigger('click')

		expect(toastError).toHaveBeenCalledWith('Please enter a rating.')
		// close() must NOT have fired; the modal stays open so input isn't lost
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(reloadReviews).not.toHaveBeenCalled()
	})

	it('scales the 0–5 rating to the stored 0–1 range', async () => {
		const wrapper = mountModal()
		await wrapper.get('[data-testid="rating"]').setValue('5')
		await wrapper.get('[data-testid="review"]').setValue('Great course')
		await wrapper.get('[data-testid="action"]').trigger('click')

		const doc = resourceConfig.makeParams().doc
		expect(doc.rating).toBe(1)
		expect(doc.review).toBe('Great course')
		expect(doc.course).toBe('C1')
		expect(doc.doctype).toBe('LMS Course Review')
	})

	it('reloads reviews + has-reviewed and closes on a successful submit', async () => {
		const wrapper = mountModal()
		await wrapper.get('[data-testid="rating"]').setValue('4')
		await wrapper.get('[data-testid="action"]').trigger('click')

		expect(reloadReviews).toHaveBeenCalled()
		expect(reloadHasReviewed).toHaveBeenCalled()
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
	})

	it('toasts the fallback when the request never reached the server', async () => {
		submitError = new TypeError('Failed to fetch')
		const wrapper = mountModal()
		await wrapper.get('[data-testid="rating"]').setValue('4')
		await wrapper.get('[data-testid="action"]').trigger('click')

		expect(toastError).toHaveBeenCalledWith('Error')
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
	})

	it("toasts the server's message when the request fails", async () => {
		submitError = { messages: ['Server said no'] }
		const wrapper = mountModal()
		await wrapper.get('[data-testid="rating"]').setValue('4')
		await wrapper.get('[data-testid="action"]').trigger('click')

		expect(toastError).toHaveBeenCalledWith('Server said no')
	})
})
