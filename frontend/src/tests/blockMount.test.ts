import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, useId } from 'vue'
import type { App } from 'vue'

vi.mock('@/stores/user', () => ({
	usersStore: () => ({
		userResource: { data: { name: 'learner@example.com' } },
	}),
}))

import { ASSESSMENT_BLOCK_SELECTOR, mountBlock } from '@/utils/blockMount'

const Probe = defineComponent({
	props: { label: { type: String, required: true } },
	setup(props) {
		const user = inject<{ data: { name: string } }>('$user')
		return () =>
			h('div', [
				h('span', { 'data-testid': 'label' }, props.label),
				h('span', { 'data-testid': 'user' }, user?.data.name),
			])
	},
})

const Translated = defineComponent({
	template: `<p data-testid="translated">{{ __('Submit') }}</p><div data-testid="html" v-safe-html="'<b>bold</b>'"></div>`,
})

const Broken = defineComponent({
	setup() {
		return () => {
			throw new Error('boom')
		}
	},
})

let app: App | null = null
let host: HTMLDivElement

beforeEach(() => {
	Object.assign(window, { translatedMessages: {} })
	host = document.createElement('div')
	document.body.append(host)
})

afterEach(() => {
	app?.unmount()
	app = null
	host.remove()
})

// Guards the helper that mounts each lesson block as its own Vue app.
// Came with this branch's one-helper mount for assessment blocks.
// Added on feat/assessment-visual-redesign to pin user, i18n, errors, preview.
describe('mountBlock', () => {
	it('mounts the component with its props and the session user', () => {
		app = mountBlock(host, Probe, { label: 'Quiz' })

		expect(host.querySelector('[data-testid="label"]')?.textContent).toBe(
			'Quiz'
		)
		expect(host.querySelector('[data-testid="user"]')?.textContent).toBe(
			'learner@example.com'
		)
	})

	it('gives the sub-app translation and the global directives', () => {
		app = mountBlock(host, Translated, {})

		expect(host.querySelector('[data-testid="translated"]')?.textContent).toBe(
			'Submit'
		)
		expect(host.querySelector('[data-testid="html"]')?.innerHTML).toBe(
			'<b>bold</b>'
		)
	})

	it('contains a render error instead of throwing into the lesson', () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

		expect(() => {
			app = mountBlock(host, Broken, {})
		}).not.toThrow()
		expect(logged).toHaveBeenCalledWith(
			'[lms] in-lesson block failed to render',
			expect.any(Error)
		)
		logged.mockRestore()
	})

	it('marks the wrapper as an assessment block kept out of lesson prose', () => {
		app = mountBlock(host, Probe, { label: 'Quiz' })

		expect(host.matches(ASSESSMENT_BLOCK_SELECTOR)).toBe(true)
		expect(host.classList.contains('not-prose')).toBe(true)
		expect(host.classList.contains('my-5')).toBe(true)
		expect(host.hasAttribute('inert')).toBe(false)
	})

	// Guards two blocks getting the same useId() ids, one app per block.
	// Came with this branch's one-helper mount for assessment blocks.
	// Added on feat/assessment-visual-redesign to pin a per-app id prefix.
	it('gives each block its own useId() space', () => {
		const IdProbe = defineComponent({
			setup: () => {
				const id = useId()
				return () => h('span', { id })
			},
		})
		const other = document.createElement('div')
		app = mountBlock(host, IdProbe, {})
		const otherApp = mountBlock(other, IdProbe, {})

		expect(host.querySelector('span')!.id).not.toBe(
			other.querySelector('span')!.id
		)
		otherApp.unmount()
	})

	it('makes a preview inert', () => {
		app = mountBlock(host, Probe, { label: 'Quiz' }, { preview: true })

		expect(host.hasAttribute('inert')).toBe(true)
	})
})
