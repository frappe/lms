// Guards shortcuts of one lesson block firing on keys pressed in another block.
// Came with this branch's change mounting assessment blocks through one helper.
// Added on feat/assessment-visual-redesign as blocks share the lesson window.
import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { sameBlock } from '@/composables/useKeyboardShortcuts'

const block = () => {
	const wrapper = document.createElement('div')
	wrapper.setAttribute('data-assessment-block', '')
	const inner = document.createElement('button')
	wrapper.append(inner)
	document.body.append(wrapper)
	return { wrapper, inner }
}

const keydownFrom = (target: EventTarget): KeyboardEvent => {
	const event = new KeyboardEvent('keydown', { key: 'Enter' })
	Object.defineProperty(event, 'target', { value: target })
	return event
}

afterEach(() => {
	document.body.replaceChildren()
})

describe('sameBlock', () => {
	it('passes a key pressed inside the same block', () => {
		const first = block()
		const guard = sameBlock(ref(first.inner))

		expect(guard(keydownFrom(first.inner))).toBe(true)
	})

	it('refuses a key pressed in another block', () => {
		const first = block()
		const second = block()
		const guard = sameBlock(ref(first.inner))

		expect(guard(keydownFrom(second.inner))).toBe(false)
	})

	it('refuses a key pressed in the lesson around the block', () => {
		const first = block()
		const guard = sameBlock(ref(first.inner))

		expect(guard(keydownFrom(document.body))).toBe(false)
	})

	it('always passes outside any block, as on a standalone page', () => {
		const page = document.createElement('div')
		document.body.append(page)
		const guard = sameBlock(ref(page))

		expect(guard(keydownFrom(document.body))).toBe(true)
	})

	it('passes while the element is not mounted yet', () => {
		const guard = sameBlock(ref<HTMLElement | null>(null))

		expect(guard(keydownFrom(document.body))).toBe(true)
	})
})
