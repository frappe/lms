/**
 * A page refetches when Flow changes the record it shows, and a page holding
 * unsaved edits offers the change instead of dropping them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide, ref } from 'vue'
import { mount } from '@vue/test-utils'

const toast = vi.hoisted(() => ({ info: vi.fn() }))
vi.mock('frappe-ui', () => ({ toast }))

import {
	FLOW_CHANGE_EVENT,
	useCourseFlowChanges,
	useFlowChanges,
	type FlowChange,
	type FlowChangeOptions,
} from '@/composables/useFlowChanges'

type Handler = (change: FlowChange) => void

const fakeSocket = () => {
	const handlers = new Set<Handler>()
	return {
		on: vi.fn((_event: string, handler: Handler) => handlers.add(handler)),
		off: vi.fn((_event: string, handler: Handler) => handlers.delete(handler)),
		emit: (change: FlowChange) =>
			handlers.forEach((handler) => handler(change)),
		get size() {
			return handlers.size
		},
	}
}

const mountWith = (setup: () => void, provided: Record<string, unknown>) => {
	const Page = defineComponent({ setup: () => (setup(), () => h('div')) })
	const Host = defineComponent({
		setup() {
			for (const [key, value] of Object.entries(provided)) provide(key, value)
			return () => h(Page)
		},
	})
	return mount(Host)
}

const course = (name = 'python'): FlowChange => ({
	doctype: 'LMS Course',
	name,
})

afterEach(() => toast.info.mockReset())

describe('useFlowChanges', () => {
	const watchPage = (options: Partial<FlowChangeOptions> = {}) => {
		const socket = fakeSocket()
		const reload = vi.fn()
		const wrapper = mountWith(
			() =>
				useFlowChanges({
					doctypes: ['LMS Course'],
					name: () => 'python',
					reload,
					...options,
				}),
			{ $socket: socket }
		)
		return { socket, reload, wrapper }
	}

	it('refetches the record the page shows', () => {
		const { socket, reload } = watchPage()
		expect(socket.on).toHaveBeenCalledWith(
			FLOW_CHANGE_EVENT,
			expect.any(Function)
		)
		socket.emit(course())
		expect(reload).toHaveBeenCalledWith(course())
	})

	it('ignores other records and doctypes', () => {
		const { socket, reload } = watchPage()
		socket.emit(course('javascript'))
		socket.emit({ doctype: 'LMS Batch', name: 'python' })
		expect(reload).not.toHaveBeenCalled()
	})

	it('follows every record of the doctype when given no name', () => {
		const { socket, reload } = watchPage({ name: undefined })
		socket.emit(course('javascript'))
		expect(reload).toHaveBeenCalledOnce()
	})

	it('offers the change to a page with unsaved edits', () => {
		const { socket, reload } = watchPage({ isDirty: () => true })
		socket.emit(course())
		expect(reload).not.toHaveBeenCalled()
		const [, options] = toast.info.mock.calls[0]
		expect(options.id).toBe('flow-change:LMS Course:python')
		options.action.onClick()
		expect(reload).toHaveBeenCalledOnce()
	})

	it('stops listening when the page goes', () => {
		const { socket, wrapper } = watchPage()
		wrapper.unmount()
		expect(socket.size).toBe(0)
	})

	it('does nothing without a socket', () => {
		expect(() =>
			mountWith(
				() => useFlowChanges({ doctypes: ['LMS Course'], reload: vi.fn() }),
				{}
			)
		).not.toThrow()
	})
})

describe('useCourseFlowChanges', () => {
	const watchCourse = (dirty: boolean) => {
		const socket = fakeSocket()
		const resource = { data: { name: 'python' }, reload: vi.fn() }
		const form = { isDirty: ref(dirty), discardChanges: vi.fn() }
		mountWith(() => useCourseFlowChanges(resource), {
			$socket: socket,
			courseForm: form,
		})
		return { socket, resource, form }
	}

	it('refetches the course and its form', () => {
		const { socket, resource, form } = watchCourse(false)
		socket.emit(course())
		expect(resource.reload).toHaveBeenCalledOnce()
		expect(form.discardChanges).toHaveBeenCalledOnce()
	})

	it('keeps unsaved edits until the user loads the change', () => {
		const { socket, resource, form } = watchCourse(true)
		socket.emit(course())
		expect(form.discardChanges).not.toHaveBeenCalled()
		toast.info.mock.calls[0][1].action.onClick()
		expect(form.discardChanges).toHaveBeenCalledOnce()
		expect(resource.reload).toHaveBeenCalledOnce()
	})
})
