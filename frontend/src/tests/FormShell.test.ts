import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FormShell from '@/components/FormShell.vue'
import { Dialog } from 'frappe-ui'

// frappe-ui doesn't resolve under vitest (see NewMemberModal.test.ts,
// ReviewModal.test.ts, etc.); stub the two pieces FormShell uses. The Dialog
// stub mirrors the real open/title/size contract closely enough to assert
// the default/actions/title slots; Button forwards its native click and
// renders the #icon slot so the back-arrow test can find and trigger it.
// The mobile page also legitimately carries role="dialog" now (finding 3),
// so tests distinguish "the desktop Dialog rendered" via findComponent(Dialog)
// rather than a bare [role="dialog"] query, which both branches would match.
vi.mock('frappe-ui', () => ({
	Dialog: {
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Button: {
		emits: ['click'],
		template: `<button @click="$emit('click', $event)"><slot name="icon" /><slot /></button>`,
	},
}))

// The component renders __() strings. Identity is safe here because no message
// in this component uses a {0} placeholder — a placeholder message returns a
// {format} object, and an identity stub would hide that.
vi.stubGlobal('__', (text: string) => text)

// FormShell registers a document-level keydown listener for Escape (finding
// 3) and moves/restores real DOM focus, so wrappers left mounted across tests
// would keep listening and fighting over document.activeElement.
enableAutoUnmount(afterEach)

const setViewport = (width: number): void => {
	// useScreenSize() reads window.innerWidth at setup, so this must be set
	// BEFORE mount, not after.
	Object.defineProperty(window, 'innerWidth', {
		value: width,
		writable: true,
		configurable: true,
	})
}

const mountShell = (width: number, extraSlots: Record<string, string> = {}) => {
	setViewport(width)
	return mount(FormShell, {
		props: { title: 'New Batch' },
		slots: {
			default: '<div class="fields">FIELDS</div>',
			actions: '<button class="save">Save</button>',
			...extraSlots,
		},
		// Focus assertions need real, connected DOM: jsdom refuses to move
		// document.activeElement onto an element that isn't attached.
		attachTo: document.body,
		global: {
			stubs: { teleport: true },
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`
			// access — Vue Test Utils needs it on the instance via global.mocks
			// too (see EmailEdit.test.ts, CouponDetails.test.ts et al.).
			mocks: { __: (text: string) => text },
		},
	})
}

describe('FormShell', () => {
	beforeEach(() => setViewport(1024))

	it('renders a dialog on desktop', () => {
		const wrapper = mountShell(1024)
		expect(wrapper.findComponent(Dialog).exists()).toBe(true)
		expect(wrapper.find('[data-testid="form-shell-page"]').exists()).toBe(false)
		expect(wrapper.html()).toContain('FIELDS')
	})

	it('renders page chrome below the mobile breakpoint', () => {
		const wrapper = mountShell(390)
		const page = wrapper.find('[data-testid="form-shell-page"]')
		expect(page.exists()).toBe(true)
		expect(wrapper.findComponent(Dialog).exists()).toBe(false)
		expect(wrapper.html()).toContain('FIELDS')
		expect(wrapper.html()).toContain('New Batch')
	})

	it('emits close when the mobile back control is pressed', async () => {
		const wrapper = mountShell(390)
		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('covers the parent list as a fixed full-screen surface on mobile', () => {
		const wrapper = mountShell(390)
		const page = wrapper.find('[data-testid="form-shell-page"]')
		// fixed + inset-0 lift the page out of main#scrollContainer's normal
		// flow so it covers the list underneath instead of rendering below it.
		// z-40 matches BottomSheet.vue — high enough to sit above the (non-fixed)
		// mobile tab bar's z-20 wrapper.
		expect(page.classes()).toContain('fixed')
		expect(page.classes()).toContain('inset-0')
		expect(page.classes()).toContain('z-40')
	})

	it('scrolls its own body now that the page is a fixed surface', () => {
		const wrapper = mountShell(390)
		// A full-screen form legitimately owns its own scroll range — unlike a
		// form embedded in main#scrollContainer, there is no outer scroller left
		// for it to fight with, so overflow-y-auto here is correct, not a bug.
		const body = wrapper.find('[data-testid="form-shell-body"]')
		expect(body.exists()).toBe(true)
		expect(body.classes()).toContain('overflow-y-auto')
		expect(body.classes()).toContain('overscroll-contain')
		expect(body.html()).toContain('FIELDS')
	})

	it('renders the actions slot in the header, not a footer, on mobile', () => {
		const wrapper = mountShell(390)
		const body = wrapper.find('[data-testid="form-shell-body"]')
		const actions = wrapper.find('[data-testid="form-shell-header-actions"]')
		expect(actions.exists()).toBe(true)
		expect(actions.html()).toContain('Save')
		// The footer is gone entirely — form actions live next to the title now.
		// A previous session shipped a footer stranded 323px above the tab bar;
		// there is no longer a bar to strand.
		expect(wrapper.find('[data-testid="form-shell-footer"]').exists()).toBe(
			false
		)
		// Still outside the scrolling body, so the actions never scroll away.
		expect(
			body.find('[data-testid="form-shell-header-actions"]').exists()
		).toBe(false)
		expect(actions.element.closest('header')).not.toBeNull()
		expect(actions.classes()).toContain('shrink-0')
	})

	it('keeps Tab inside the mobile page instead of leaking to the list behind', async () => {
		// aria-modal hides the list page from a screen reader; nothing hid it
		// from Tab. While the actions sat in a footer they were the last stop,
		// so the leak was only reachable past them. It is the stop after the
		// last field now.
		const wrapper = mountShell(390, {
			default: '<div class="fields"><input class="field" /></div>',
		})
		const page = wrapper.find('[data-testid="form-shell-page"]')
		// Header first, body last: back, Save, then the field.
		const field = page.find('input.field')
		const back = page.find('[data-testid="form-shell-back"]')
		;(field.element as HTMLElement).focus()
		expect(document.activeElement).toBe(field.element)

		const forward = new KeyboardEvent('keydown', {
			key: 'Tab',
			cancelable: true,
		})
		document.dispatchEvent(forward)
		expect(forward.defaultPrevented).toBe(true)
		expect(document.activeElement).toBe(back.element)
	})

	it('does not count a display:none input as the last tab stop', async () => {
		// frappe-ui's FileUploader renders <input type="file" class="hidden">,
		// which has no `hidden` attribute. Counting it made it `last` on any form
		// ending in an uploader, so Tab wrapped off an element that cannot hold
		// focus and the real last field never wrapped at all.
		const wrapper = mountShell(390, {
			default: `<div class="fields"><input class="field" /><input type="file" class="upload" style="display:none" /></div>`,
		})
		const page = wrapper.find('[data-testid="form-shell-page"]')
		const field = page.find('input.field')
		const back = page.find('[data-testid="form-shell-back"]')
		;(field.element as HTMLElement).focus()

		const forward = new KeyboardEvent('keydown', {
			key: 'Tab',
			cancelable: true,
		})
		document.dispatchEvent(forward)

		expect(forward.defaultPrevented).toBe(true)
		expect(document.activeElement).toBe(back.element)
	})

	it('gives the mobile page dialog semantics, labelled by its title', () => {
		const wrapper = mountShell(390)
		const page = wrapper.find('[data-testid="form-shell-page"]')
		expect(page.attributes('role')).toBe('dialog')
		expect(page.attributes('aria-modal')).toBe('true')
		const labelledby = page.attributes('aria-labelledby')
		expect(labelledby).toBeTruthy()
		const titleEl = wrapper.find(`#${labelledby}`)
		expect(titleEl.exists()).toBe(true)
		expect(titleEl.text()).toBe('New Batch')
	})

	it('titles the mobile page with the <h1> that labels the dialog', () => {
		// This used to be a <p>, on the premise that the list page's own <h1>
		// stayed in the a11y tree alongside it. Marking the background inert
		// falsified that: without a heading here the form is a document with
		// none at all, so H-key and rotor navigation find nothing.
		const wrapper = mountShell(390)
		const heading = wrapper.get('h1')
		const page = wrapper.find('[data-testid="form-shell-page"]')

		expect(heading.text()).toBe('New Batch')
		expect(page.attributes('aria-labelledby')).toBe(heading.attributes('id'))
	})

	// jsdom implements neither `inert` nor the accessibility tree, so these
	// assert the attribute bookkeeping only. That the background actually stops
	// taking focus, stops being hit-testable and leaves the a11y tree is NOT
	// covered here and needs a browser.
	describe('inert background', () => {
		let app: HTMLElement

		beforeEach(() => {
			app = document.createElement('div')
			app.id = 'app'
			document.body.appendChild(app)
		})

		afterEach(() => app.remove())

		it('inerts the app root while open on mobile', () => {
			const wrapper = mountShell(390)
			expect(app.hasAttribute('inert')).toBe(true)

			wrapper.unmount()
			expect(app.hasAttribute('inert')).toBe(false)
		})

		it('leaves the app root alone on desktop', () => {
			mountShell(1024)
			expect(app.hasAttribute('inert')).toBe(false)
		})

		it('stays inert until the last overlay closes', () => {
			// A BottomSheet opened inside a form wants the same thing; a naive
			// remove-on-close from the inner one would wake the background while
			// the form is still open.
			const outer = mountShell(390)
			const inner = mountShell(390)

			inner.unmount()
			expect(app.hasAttribute('inert')).toBe(true)

			outer.unmount()
			expect(app.hasAttribute('inert')).toBe(false)
		})
	})

	it('closes on Escape while the mobile page is open', () => {
		const wrapper = mountShell(390)
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	// reka-ui — which frappe-ui's Combobox builds on, and which the LMS `Link`
	// control reaches through it — dismisses a layer from vueuse's onKeyStroke,
	// whose default target is `window`. Bubbling reaches `document` first and
	// reka never calls preventDefault, so FormShell cannot use defaultPrevented
	// to know a popover is open; it looks for the layer element reka renders
	// (`data-dismissable-layer`, DismissableLayer.js:104). The layer portals to
	// <body>, so it is NOT inside pageRef and cannot be found by containment.
	//
	// The stubs below mirror that DOM rather than reka itself, because frappe-ui
	// does not resolve under vitest (see the mock at the top of this file).
	describe('Escape with an open popover layer', () => {
		// `Link` uses the combobox's input mode: focus stays on the input inside
		// pageRef and the listbox is portaled out, related only by aria-controls.
		const mountWithCombobox = () =>
			mountShell(390, {
				default: `<div class="fields"><input class="link-input" aria-expanded="true" aria-controls="cbx-1" /></div>`,
			})

		const openLayer = (id = 'cbx-1'): HTMLElement => {
			const layer = document.createElement('div')
			layer.setAttribute('data-dismissable-layer', '')
			layer.setAttribute('data-state', 'open')
			layer.id = id
			document.body.appendChild(layer)
			return layer
		}

		const pressEscape = (from: Element, init: KeyboardEventInit = {}): void => {
			from.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
					...init,
				})
			)
		}

		it('leaves the form mounted so the popover takes the Escape', () => {
			const wrapper = mountWithCombobox()
			const layer = openLayer()
			const input = wrapper.find('.link-input').element as HTMLElement
			input.focus()

			pressEscape(input)

			expect(wrapper.emitted('close')).toBeUndefined()
			layer.remove()
		})

		it('does not swallow the event, so reka-ui still receives it on window', () => {
			// Guards against "fixing" this with stopPropagation, which would
			// leave the popover stuck open with no way to dismiss it.
			const wrapper = mountWithCombobox()
			const layer = openLayer()
			const input = wrapper.find('.link-input').element as HTMLElement
			input.focus()
			const onWindow = vi.fn()
			window.addEventListener('keydown', onWindow)

			pressEscape(input)

			expect(onWindow).toHaveBeenCalledTimes(1)
			window.removeEventListener('keydown', onWindow)
			layer.remove()
		})

		it('closes on the next Escape once the popover has closed', () => {
			const wrapper = mountWithCombobox()
			const layer = openLayer()
			const input = wrapper.find('.link-input').element as HTMLElement
			input.focus()
			pressEscape(input)
			expect(wrapper.emitted('close')).toBeUndefined()

			layer.remove()
			input.setAttribute('aria-expanded', 'false')
			pressEscape(input)

			expect(wrapper.emitted('close')).toHaveLength(1)
		})

		it('still closes when the focused control does not own the layer', () => {
			// HeaderButton wraps mobile icon actions in a Tooltip, and reka opens
			// a tooltip on keyboard focus — so a layer is in the DOM whenever Save
			// has focus. Escape must still close the form.
			const wrapper = mountShell(390, {
				actions: '<button class="save" aria-describedby="tip-1">Save</button>',
			})
			const layer = openLayer('tip-1')
			const save = wrapper.find('.save').element as HTMLElement
			save.focus()

			pressEscape(save)

			expect(wrapper.emitted('close')).toHaveLength(1)
			layer.remove()
		})

		it('ignores autorepeat so a held Escape cannot close the form', () => {
			const wrapper = mountWithCombobox()
			const layer = openLayer()
			const input = wrapper.find('.link-input').element as HTMLElement
			input.focus()

			pressEscape(input)
			layer.remove()
			input.setAttribute('aria-expanded', 'false')
			pressEscape(input, { repeat: true })

			expect(wrapper.emitted('close')).toBeUndefined()
		})

		it('ignores Escape that cancels an IME composition', () => {
			const wrapper = mountShell(390)
			const page = wrapper.find('[data-testid="form-shell-page"]')
				.element as HTMLElement
			const event = new KeyboardEvent('keydown', {
				key: 'Escape',
				bubbles: true,
				cancelable: true,
			})
			// jsdom drops isComposing from the init dict.
			Object.defineProperty(event, 'isComposing', { value: true })

			page.dispatchEvent(event)

			expect(wrapper.emitted('close')).toBeUndefined()
		})

		it('defers Tab to the popover instead of wrapping focus to the header', () => {
			const wrapper = mountWithCombobox()
			const layer = openLayer()
			const input = wrapper.find('.link-input').element as HTMLElement
			input.focus()
			const tab = new KeyboardEvent('keydown', {
				key: 'Tab',
				bubbles: true,
				cancelable: true,
			})

			input.dispatchEvent(tab)

			expect(tab.defaultPrevented).toBe(false)
			expect(document.activeElement).toBe(input)
			layer.remove()
		})
	})

	it('moves focus into the page on mount and restores it on unmount', () => {
		const outside = document.createElement('button')
		document.body.appendChild(outside)
		outside.focus()
		expect(document.activeElement).toBe(outside)

		const wrapper = mountShell(390)
		const page = wrapper.find('[data-testid="form-shell-page"]')
		expect(document.activeElement).toBe(page.element)

		wrapper.unmount()
		expect(document.activeElement).toBe(outside)
		document.body.removeChild(outside)
	})

	// The trigger that opened the form usually survives, because forms are child
	// routes and the list behind stays mounted. But a save reloads the list
	// resource and re-renders its rows, so the captured node is replaced and
	// focus() on it is a silent no-op that strands the user on <body>. The next
	// Tab then restarts at "Skip to main content". WCAG 2.4.3, failure F85.
	describe('focus restore when the trigger is gone', () => {
		let scroller: HTMLElement

		beforeEach(() => {
			// MobileLayout's <main id="scrollContainer" tabindex="-1"> is already
			// the skip-link target, so it is the sanctioned landing spot rather
			// than a new one invented here.
			scroller = document.createElement('main')
			scroller.id = 'scrollContainer'
			scroller.tabIndex = -1
			document.body.appendChild(scroller)
		})

		afterEach(() => scroller.remove())

		it('lands on the scroll container when the trigger was removed', () => {
			const outside = document.createElement('button')
			document.body.appendChild(outside)
			outside.focus()
			const wrapper = mountShell(390)

			outside.remove()
			wrapper.unmount()

			expect(document.activeElement).toBe(scroller)
		})

		it('lands on the scroll container when nothing had focus', () => {
			// activeElement reads as <body>, which is connected but cannot hold
			// focus, so an isConnected check alone would still strand the user.
			;(document.activeElement as HTMLElement | null)?.blur()
			const wrapper = mountShell(390)

			wrapper.unmount()

			expect(document.activeElement).toBe(scroller)
		})

		it('still restores after the viewport crosses the breakpoint', async () => {
			// useScreenSize is resize-driven, so this is reachable: the guard has
			// to record that focus was ever taken, not what the viewport is now.
			const outside = document.createElement('button')
			document.body.appendChild(outside)
			outside.focus()
			const wrapper = mountShell(390)

			setViewport(1024)
			window.dispatchEvent(new Event('resize'))
			await nextTick()
			wrapper.unmount()

			expect(document.activeElement).toBe(outside)
			outside.remove()
		})
	})

	it('forwards header-action to the desktop Dialog too, not just mobile', () => {
		// A later form's Delete-next-to-the-title control would otherwise
		// vanish above the mobile breakpoint.
		const wrapper = mountShell(1024, {
			'header-action': '<button class="delete">Delete</button>',
		})
		expect(wrapper.find('.delete').exists()).toBe(true)
	})
	// The transition sits INSIDE the Teleport for a load-bearing reason: a
	// transform on any ancestor would establish a containing block for the
	// page's `fixed inset-0` and drop it back into the scroll container. These
	// pin that it is applied to the teleported node itself, and that a user who
	// asked for less motion gets none.
	describe('enter transition', () => {
		const setReducedMotion = (reduce: boolean): void => {
			Object.defineProperty(window, 'matchMedia', {
				writable: true,
				configurable: true,
				value: (query: string) => ({
					matches: query.includes('prefers-reduced-motion') ? reduce : false,
					media: query,
					addEventListener: () => {},
					removeEventListener: () => {},
					addListener: () => {},
					removeListener: () => {},
					onchange: null,
					dispatchEvent: () => false,
				}),
			})
		}

		it('animates the mobile page in by default', () => {
			setReducedMotion(false)
			const wrapper = mountShell(390)

			const transition = wrapper.findComponent({ name: 'Transition' })
			expect(transition.props('enterActiveClass')).toContain('transition')
			expect(transition.props('enterFromClass')).toContain('opacity-0')
		})

		it('applies no transition classes under prefers-reduced-motion', () => {
			setReducedMotion(true)
			const wrapper = mountShell(390)

			const transition = wrapper.findComponent({ name: 'Transition' })
			expect(transition.props('enterActiveClass')).toBe('')
			expect(transition.props('enterFromClass')).toBe('')
			expect(transition.props('enterToClass')).toBe('')
		})

		it('leaves the desktop dialog alone — it is not the teleported page', () => {
			setReducedMotion(false)
			const wrapper = mountShell(1024)

			expect(wrapper.findComponent({ name: 'Transition' }).exists()).toBe(false)
		})
	})
})
