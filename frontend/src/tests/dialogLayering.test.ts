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

const layerOf = (overlay: HTMLElement) => Number(overlay.style.zIndex || 0)

describe('dialog layering', () => {
	let scope: EffectScope

	beforeEach(() => {
		document.body.innerHTML = ''
		document.getElementById('dialog-layering')?.remove()
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
})
