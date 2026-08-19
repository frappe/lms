/**
 * Link's `onCreate` contract: outside `inlineCreate` mode the control closes
 * its own dropdown and calls the handler with ONE argument. Its `CreateHandler`
 * type declares the close callback optional to match, but the two forms
 * converted to routed pages were both written as `(value, closeLink) =>
 * closeLink()` — a TypeError on every click, invisible because the `.vue`
 * script blocks are untyped and both components are stubbed out of the route
 * tests.
 *
 * The assertion is on the argument Link actually passes, so it holds for every
 * present and future onCreate handler rather than for the two that were wrong.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Link from '@/components/Controls/Link.vue'

vi.mock('frappe-ui', () => ({
	// Renders the footer slot unconditionally — the real Combobox only shows it
	// while open, which is dropdown mechanics this test is not about.
	Combobox: {
		props: ['options', 'modelValue', 'open'],
		template: `<div><slot name="footer" /></div>`,
	},
	Button: {
		props: ['variant', 'size', 'ariaLabel', 'disabled'],
		// `emits` is required: without it the parent's @click also falls through
		// to the root element natively and every handler fires twice.
		emits: ['click'],
		template: `<button type="button" :aria-label="ariaLabel" @click="$emit('click')"><slot /></button>`,
	},
	FormControl: { props: ['modelValue'], template: `<input />` },
	FormLabel: { props: ['label'], template: `<label>{{ label }}</label>` },
	createResource: () => ({
		data: [],
		loading: false,
		update: () => {},
		reload: () => {},
		fetch: () => {},
	}),
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))

const mountLink = (onCreate: (...args: unknown[]) => void) =>
	mount(Link, {
		props: { doctype: 'Course', onCreate },
		global: { mocks: { __: (s: string) => s } },
	})

const clickCreateNew = async (wrapper: ReturnType<typeof mountLink>) => {
	const button = wrapper
		.findAll('button')
		.find((b) => b.attributes('aria-label') === 'Create New')
	expect(
		button,
		'Create New button should render when onCreate is passed'
	).toBeTruthy()
	await button!.trigger('click')
}

describe('Link onCreate contract', () => {
	it('passes exactly one argument when not in inlineCreate mode', async () => {
		const onCreate = vi.fn()
		await clickCreateNew(mountLink(onCreate))

		expect(onCreate).toHaveBeenCalledTimes(1)
		// The regression: handlers assumed a second `close` callback was here.
		expect(onCreate.mock.calls[0]).toHaveLength(1)
		expect(onCreate.mock.calls[0][0]).toBeNull()
	})

	it('does not hand the handler a close callback to invoke', async () => {
		const received: unknown[] = []
		await clickCreateNew(
			mountLink((...args) => received.push(...args.slice(1)))
		)

		expect(received).toEqual([])
	})

	it('survives a handler that takes no parameters at all', async () => {
		const onCreate = vi.fn(() => {})
		await clickCreateNew(mountLink(onCreate))

		expect(onCreate).toHaveBeenCalledOnce()
	})
})
