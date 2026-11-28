import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

interface Action {
	label: string
	onClick: (context: { close: () => void }) => unknown
}
interface FakeDialog {
	title: string
	show: boolean
	actions: Action[]
}

const { dialogs } = vi.hoisted(() => ({ dialogs: [] as FakeDialog[] }))

vi.mock('@/utils/dialogs', () => ({
	createDialog: (dialog: FakeDialog) => {
		dialog.show = true
		dialogs.push(dialog)
	},
}))

import {
	confirmUnsavedChanges,
	useUnsavedChangesGuard,
} from '@/composables/useUnsavedChangesGuard'

const isDirty = ref(false)
const isSaving = ref(false)
const save = vi.fn(async () => true)

const Editor = defineComponent({
	setup() {
		useUnsavedChangesGuard({
			isDirty: () => isDirty.value,
			isSaving: () => isSaving.value,
			save,
			param: 'courseName',
		})
		return () => h('div', 'editor')
	},
})
const Blank = defineComponent({ render: () => h('div') })

const lastDialog = (): FakeDialog => dialogs[dialogs.length - 1]

async function answer(label: string): Promise<void> {
	const dialog = lastDialog()
	const action = dialog.actions.find((each) => each.label === label)!
	await action.onClick({ close: () => (dialog.show = false) })
	await flushPromises()
}

describe('the unsaved changes guard', () => {
	let wrapper: VueWrapper
	let router: ReturnType<typeof createRouter>

	beforeEach(async () => {
		dialogs.length = 0
		isDirty.value = false
		isSaving.value = false
		save.mockClear()
		save.mockResolvedValue(true)
		router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/courses', name: 'Courses', component: Blank },
				{ path: '/courses/:courseName', name: 'Course', component: Editor },
				{ path: '/programs/:id', name: 'ProgramForm', component: Blank },
			],
		})
		router.push('/courses/c1#overview')
		await router.isReady()
		wrapper = mount(RouterView, { global: { plugins: [router] } })
	})
	afterEach(() => wrapper.unmount())

	const path = () => router.currentRoute.value.fullPath

	it('leaves without asking when nothing changed', async () => {
		await router.push('/courses')
		expect(dialogs).toHaveLength(0)
		expect(path()).toBe('/courses')
	})

	it('asks before leaving with edits, and Stay keeps the page', async () => {
		isDirty.value = true
		const leaving = router.push('/courses')
		await flushPromises()
		expect(lastDialog().title).toBe('Discard unsaved changes?')
		expect(lastDialog().actions.map((action) => action.label)).toEqual([
			'Save and leave',
			'Discard',
			'Stay',
		])
		await answer('Stay')
		await leaving
		expect(path()).toBe('/courses/c1#overview')
		expect(save).not.toHaveBeenCalled()
	})

	it('treats dismissing the dialog as Stay', async () => {
		isDirty.value = true
		const leaving = router.push('/courses')
		await flushPromises()
		lastDialog().show = false
		await leaving
		expect(path()).toBe('/courses/c1#overview')
	})

	it('leaves without saving on Discard', async () => {
		isDirty.value = true
		const leaving = router.push('/courses')
		await flushPromises()
		await answer('Discard')
		await leaving
		expect(path()).toBe('/courses')
		expect(save).not.toHaveBeenCalled()
	})

	it('saves then leaves on Save and leave', async () => {
		isDirty.value = true
		const leaving = router.push('/courses')
		await flushPromises()
		await answer('Save and leave')
		await leaving
		expect(save).toHaveBeenCalledTimes(1)
		expect(path()).toBe('/courses')
	})

	it('stays when Save and leave could not save', async () => {
		isDirty.value = true
		save.mockResolvedValue(false)
		const leaving = router.push('/courses')
		await flushPromises()
		await answer('Save and leave')
		await leaving
		expect(path()).toBe('/courses/c1#overview')
	})

	it('switches tabs in the same course without asking', async () => {
		isDirty.value = true
		await router.push('/courses/c1#settings')
		await router.push('/courses/c1?studentView=enrolled#settings')
		expect(dialogs).toHaveLength(0)
		expect(path()).toBe('/courses/c1?studentView=enrolled#settings')
	})

	it('asks before opening another course', async () => {
		isDirty.value = true
		const leaving = router.push('/courses/c2')
		await flushPromises()
		expect(dialogs).toHaveLength(1)
		await answer('Stay')
		await leaving
		expect(path()).toBe('/courses/c1#overview')
	})

	it('lets a modal form open over the page', async () => {
		isDirty.value = true
		await router.push('/programs/p1')
		expect(dialogs).toHaveLength(0)
	})

	it('does not ask while a save is in flight', async () => {
		isDirty.value = true
		isSaving.value = true
		await router.push('/courses')
		expect(dialogs).toHaveLength(0)
	})

	it('warns on reload or tab close only while there are edits', () => {
		const clean = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(clean)
		expect(clean.defaultPrevented).toBe(false)

		isDirty.value = true
		const dirty = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(dirty)
		expect(dirty.defaultPrevented).toBe(true)
	})

	it('stops warning on reload once the page is gone', () => {
		wrapper.unmount()
		isDirty.value = true
		const event = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(false)
		wrapper = mount(Blank)
	})
})

describe('confirmUnsavedChanges, before student view', () => {
	const discard = vi.fn()
	const ask = async () => {
		const result = confirmUnsavedChanges({
			isDirty: () => isDirty.value,
			isSaving: () => isSaving.value,
			save,
			discard,
		})
		await flushPromises()
		return { result }
	}

	beforeEach(() => {
		dialogs.length = 0
		isDirty.value = true
		isSaving.value = false
		save.mockClear()
		discard.mockClear()
	})

	it('goes ahead without asking when nothing changed', async () => {
		isDirty.value = false
		await expect((await ask()).result).resolves.toBe(true)
		expect(dialogs).toHaveLength(0)
	})

	it('reverts the form on Discard, then goes ahead', async () => {
		const { result } = await ask()
		await answer('Discard')
		await expect(result).resolves.toBe(true)
		expect(discard).toHaveBeenCalledOnce()
		expect(save).not.toHaveBeenCalled()
	})

	it('saves on Save and leave, then goes ahead', async () => {
		const { result } = await ask()
		await answer('Save and leave')
		await expect(result).resolves.toBe(true)
		expect(save).toHaveBeenCalledOnce()
		expect(discard).not.toHaveBeenCalled()
	})

	it('keeps the edits on Stay', async () => {
		const { result } = await ask()
		await answer('Stay')
		await expect(result).resolves.toBe(false)
		expect(discard).not.toHaveBeenCalled()
	})
})
