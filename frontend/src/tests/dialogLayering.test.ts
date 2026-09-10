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
})
