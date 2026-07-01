/**
 * ReviewModal.vue — submit behavior.
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

// frappe-ui doesn't resolve under vitest; stub the pieces ReviewModal uses.
// The Dialog stub renders each action as a button that invokes its onClick with
// a { close } that emits update:open=false, mirroring the real Dialog contract.
// createResource.submit runs validate() and routes to onError/onSuccess so the
// component's real wiring is exercised without a network call.
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
					validate?: () => string | undefined
					onError?: (e: unknown) => void
					onSuccess?: () => void
				}
			) => {
				const err = opts.validate?.()
				if (err) opts.onError?.(err)
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

beforeEach(() => vi.clearAllMocks())

describe('ReviewModal submit', () => {
	it('keeps the dialog open and shows an error when the rating is missing', async () => {
		const wrapper = mountModal()
		await wrapper.get('[data-testid="action"]').trigger('click')

		expect(toastError).toHaveBeenCalledWith('Please enter a rating.')
		// close() must NOT have fired — the modal stays open so input isn't lost
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
})
