// The stack has to survive an overlay that outlives the dialog that opened it:
// a stranded overlay must never tie with, or outrank, a dialog opened later.
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { useDialogLayering } from '@/composables/dialogLayering'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const openOverlay = (): HTMLElement => {
	const overlay = document.createElement('div')
	overlay.className = 'dialog-overlay'
	const content = document.createElement('div')
	content.setAttribute('role', 'dialog')
	overlay.appendChild(content)
	document.body.appendChild(overlay)
	return overlay
}

// frappe-ui 1.0.0-beta.29's shape: DialogContent lives in a sibling
// `.dialog-scroll-container`, not inside the overlay itself.
const openDialog = (): { overlay: HTMLElement; panel: HTMLElement } => {
	const overlay = document.createElement('div')
	overlay.className = 'dialog-overlay'
	document.body.appendChild(overlay)

	const panel = document.createElement('div')
	panel.className = 'dialog-scroll-container'
	const content = document.createElement('div')
	content.setAttribute('role', 'dialog')
	panel.appendChild(content)
	document.body.appendChild(panel)

	return { overlay, panel }
}

const layerOf = (overlay: HTMLElement) => Number(overlay.style.zIndex || 0)

describe('dialog layering', () => {
	let scope: EffectScope

	beforeEach(() => {
		document.body.innerHTML = ''
		document.getElementById('dialog-layering')?.remove()
		delete (window as unknown as { __dialogLayeringDebug?: unknown[] })
			.__dialogLayeringDebug
		scope = effectScope()
		scope.run(() => useDialogLayering())
	})

	afterEach(() => {
		scope.stop()
		document.body.innerHTML = ''
	})

	it('stacks each dialog above the one opened before it', async () => {
		const first = openOverlay()
		await settle()
		const second = openOverlay()
		await settle()

		expect(layerOf(second)).toBeGreaterThan(layerOf(first))
	})

	// `inert` has been caught, live in CI only, still not enough to stop a
	// click landing on a covered overlay — see dialogLayering.ts's own
	// comment. pointer-events is set explicitly, redundantly, alongside it.
	it('sets pointer-events none on a covered overlay and auto on the top one', async () => {
		const first = openOverlay()
		await settle()
		const second = openOverlay()
		await settle()

		expect(first.style.pointerEvents).toBe('none')
		expect(second.style.pointerEvents).toBe('auto')
		expect(first.inert).toBe(true)
		expect(second.inert).toBe(false)
	})

	it('records each restack in a bounded debug ring for forensics', async () => {
		for (let i = 0; i < 60; i++) {
			openOverlay()
			await settle()
		}

		const ring = (
			window as unknown as {
				__dialogLayeringDebug: Array<{ openCount: number }>
			}
		).__dialogLayeringDebug
		expect(ring.length).toBe(50)
		expect(ring.at(-1)?.openCount).toBe(60)
	})

	it('keeps a stranded overlay below a dialog opened after it', async () => {
		const stranded = openOverlay()
		await settle()

		// The dialog closes: its overlay leaves the DOM, and with nothing open the
		// stack starts over. The node is then put back, as a teardown that loses
		// its teleported overlay does.
		stranded.remove()
		await settle()
		document.body.appendChild(stranded)
		await settle()

		const opened = openOverlay()
		await settle()

		expect(layerOf(opened)).toBeGreaterThan(layerOf(stranded))
	})

	// A dropdown/nav menu whose selection already fired (e.g. "Create > New
	// Course") can still be a body child for a beat after the dialog it is
	// unrelated to opens — its own leave transition hasn't removed the node
	// yet. Clicking inside the freshly-opened dialog must not be mistaken for
	// "dismiss the menu that's covering this dialog": that menu is stale, not
	// really on top, and reka's real Escape handling would land on the
	// dialog, not the menu.
	describe('the stale-popper Escape workaround', () => {
		const openPopper = (): HTMLElement => {
			const popper = document.createElement('div')
			popper.setAttribute('data-reka-popper-content-wrapper', '')
			document.body.appendChild(popper)
			return popper
		}

		const escapeDispatched = (): Promise<boolean> => {
			return new Promise((resolve) => {
				const onKeydown = (e: KeyboardEvent) => {
					if (e.key !== 'Escape') return
					document.removeEventListener('keydown', onKeydown)
					resolve(true)
				}
				document.addEventListener('keydown', onKeydown)
				setTimeout(() => {
					document.removeEventListener('keydown', onKeydown)
					resolve(false)
				}, 0)
			})
		}

		const pointerdownInside = (el: HTMLElement) => {
			const target = document.createElement('button')
			el.appendChild(target)
			target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
		}

		it('does not fire for a stale popper that predates the dialog', async () => {
			// The "Create" dropdown opens and its selection already fired, but
			// its node outlives the click.
			openPopper()
			await settle()

			// The dialog it opened is a genuinely new, unrelated overlay.
			const overlay = openOverlay()
			await settle()

			const done = escapeDispatched()
			pointerdownInside(overlay.querySelector('[role="dialog"]')!)
			expect(await done).toBe(false)
		})

		it('still fires for a popper genuinely opened from within the top dialog', async () => {
			const overlay = openOverlay()
			await settle()

			// A Select/Combobox opened from inside the already-open dialog.
			openPopper()
			await settle()

			const done = escapeDispatched()
			pointerdownInside(overlay.querySelector('[role="dialog"]')!)
			expect(await done).toBe(true)
		})
	})

	// beta.29 moved DialogContent out of the overlay into a sibling
	// `.dialog-scroll-container` — see dialogLayering.ts's top comment. The
	// overlay's own explicit z-index otherwise paints over that sibling,
	// covering a dialog's content with its own overlay.
	describe('the beta.29 sibling panel shape', () => {
		it("gives a dialog's panel the same z-index as its overlay", async () => {
			openDialog()
			await settle()
			const { overlay, panel } = openDialog()
			await settle()

			expect(layerOf(panel)).toBe(layerOf(overlay))
			expect(layerOf(panel)).toBeGreaterThan(0)
		})

		it('marks a covered panel inert with pointer-events none, and leaves the top panel interactive', async () => {
			const first = openDialog()
			await settle()
			const second = openDialog()
			await settle()

			expect(first.panel.inert).toBe(true)
			expect(first.panel.style.pointerEvents).toBe('none')

			expect(second.panel.inert).toBe(false)
			expect(second.panel.style.pointerEvents).toBe('')
		})

		it('applies data-dialog-interactive to the content inside the panel when a popper opens from the top dialog', async () => {
			const { overlay, panel } = openDialog()
			await settle()

			const popper = document.createElement('div')
			popper.setAttribute('data-reka-popper-content-wrapper', '')
			document.body.appendChild(popper)
			await settle()

			const content = panel.querySelector('[role="dialog"]')!
			expect(content.hasAttribute('data-dialog-interactive')).toBe(true)
			expect(overlay.querySelector('[role="dialog"]')).toBeNull()
		})
	})
})
