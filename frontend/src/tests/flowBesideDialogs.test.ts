/**
 * Flow's docked panel stays usable beside a modal: what happens in Flow never
 * reaches the document listeners a modal dismisses itself and traps focus with.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keepFlowUsableBesideDialogs } from '@/utils/flowBesideDialogs'

let flowInput: HTMLInputElement
let dialogInput: HTMLInputElement

// Built per test: the suite's setup clears the body between tests.
beforeEach(() => {
	const host = document.createElement('flow-launcher')
	flowInput = document.createElement('input')
	host.append(flowInput)
	dialogInput = document.createElement('input')
	document.body.append(host, dialogInput)
	keepFlowUsableBesideDialogs()
})

afterEach(() => {
	document.body.style.pointerEvents = ''
})

const reachesDocument = (type: string, dispatch: () => void) => {
	const listener = vi.fn()
	document.addEventListener(type, listener)
	dispatch()
	document.removeEventListener(type, listener)
	return listener.mock.calls.length > 0
}

const pointerdownInFlow = () =>
	flowInput.dispatchEvent(new Event('pointerdown', { bubbles: true }))

describe('Flow beside a modal', () => {
	it('keeps a pointerdown in Flow from the page while a modal is open', () => {
		document.body.style.pointerEvents = 'none'
		expect(reachesDocument('pointerdown', pointerdownInFlow)).toBe(false)
	})

	it('leaves a pointerdown in Flow alone when no modal is open', () => {
		expect(reachesDocument('pointerdown', pointerdownInFlow)).toBe(true)
	})

	it('keeps Escape in Flow from closing the modal, but not other keys', () => {
		document.body.style.pointerEvents = 'none'
		const press = (key: string) => () =>
			flowInput.dispatchEvent(
				new KeyboardEvent('keydown', { key, bubbles: true })
			)
		expect(reachesDocument('keydown', press('Escape'))).toBe(false)
		expect(reachesDocument('keydown', press('a'))).toBe(true)
	})

	it('hides focus leaving the modal for Flow from its focus trap', () => {
		document.body.style.pointerEvents = 'none'
		const leaveFor = (target: Element) => () =>
			dialogInput.dispatchEvent(
				new FocusEvent('focusout', { bubbles: true, relatedTarget: target })
			)
		expect(reachesDocument('focusout', leaveFor(flowInput))).toBe(false)
		expect(reachesDocument('focusout', leaveFor(document.body))).toBe(true)
	})
})
