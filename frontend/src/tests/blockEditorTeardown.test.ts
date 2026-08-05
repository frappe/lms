import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'

// vi.mock factories are hoisted above module init, so the shared refs they close
// over must be created via vi.hoisted. `state.onReady` captures the onReady
// config callback EditorJS would invoke once initialised, letting the test
// control *when* onReady fires relative to mount/unmount.
const mocks = vi.hoisted(() => ({
	DragDrop: vi.fn(),
	destroy: vi.fn(),
	state: { onReady: null as null | (() => void) },
}))

vi.mock('@editorjs/editorjs', () => ({
	default: class {
		isReady = Promise.resolve()
		destroy = mocks.destroy
		constructor(config: { onReady?: () => void }) {
			mocks.state.onReady = config.onReady ?? null
		}
	},
}))

// DragDrop's real constructor reads `editor.configuration`; here we only need to
// know whether BlockEditor tried to construct it.
vi.mock('editorjs-drag-drop', () => ({ default: mocks.DragDrop }))

vi.mock('@/utils', () => ({
	getEditorTools: () => ({}),
	getEditorTunes: () => [],
	enablePlyr: () => {},
}))

import BlockEditor from '@/components/BlockEditor.vue'

describe('BlockEditor onReady teardown race', () => {
	let wrapper: VueWrapper

	beforeEach(() => {
		mocks.state.onReady = null
		mocks.DragDrop.mockClear()
		mocks.destroy.mockClear()
	})

	afterEach(() => {
		try {
			wrapper?.unmount()
		} catch {
			// already unmounted by the test
		}
		document.body.innerHTML = ''
	})

	it('does not construct DragDrop(null) when onReady fires after unmount', () => {
		wrapper = mount(BlockEditor, { attachTo: document.body })
		expect(mocks.state.onReady).toBeTypeOf('function')

		// onBeforeUnmount nulls the internal editor ref...
		wrapper.unmount()
		// ...and EditorJS only now resolves and invokes the queued onReady. With
		// the guard this is a no-op; without it, BlockEditor would call
		// `new DragDrop(null)`, whose constructor reads null.configuration.
		expect(() => mocks.state.onReady?.()).not.toThrow()
		expect(mocks.DragDrop).not.toHaveBeenCalled()
	})

	it('constructs DragDrop once when onReady fires while still mounted', () => {
		wrapper = mount(BlockEditor, { attachTo: document.body })
		expect(mocks.state.onReady).toBeTypeOf('function')

		mocks.state.onReady?.()
		expect(mocks.DragDrop).toHaveBeenCalledTimes(1)
	})
})
