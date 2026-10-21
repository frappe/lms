import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	enableAutoUnmount,
	flushPromises,
	mount,
	type VueWrapper,
} from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h } from 'vue'

// The form registers a window-level keydown listener and only removes it on
// unmount. Without this, wrappers left mounted by earlier tests keep listening
// and the Ctrl+S test sees one call per surviving instance.
enableAutoUnmount(afterEach)

const insertSubmit = vi.fn()
const listResource = {
	insert: { submit: insertSubmit, loading: false },
	data: [],
}
// A vi.fn (not a bare arrow) so a test can assert what it was called WITH —
// specifically the cache key, the single load-bearing reason a created batch
// shows up in the list at all (Batches.vue:167 has to use the byte-identical
// key for createListResource's shared-instance cache to hand back the SAME
// resource). vi.hoisted because vi.mock's factory is hoisted above ALL
// top-level code (including plain `const`s), so a bare `vi.fn()` referenced
// inside it throws "Cannot access before initialization".
const { createListResourceMock, captureMock } = vi.hoisted(() => ({
	createListResourceMock: vi.fn(),
	captureMock: vi.fn(),
}))
createListResourceMock.mockReturnValue(listResource)

// Stubbed so tests control resource data and render light stand-ins.
const { passthrough } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time. hoisted so
	// it lands before the (hoisted) component import runs.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		// Renders its label, as the real Combobox/Select/MultiSelect do: a stub
		// that drops it makes "every field is labelled" pass by omission.
		passthrough: {
			inheritAttrs: false,
			props: ['label'],
			template: `<div><label v-if="label">{{ label }}</label><slot name="icon" /><slot /></div>`,
		},
	}
})

// HeaderButton wraps frappe-ui's Button in a Tooltip below the mobile
// breakpoint, and the hand-written frappe-ui mock here has no Tooltip. Stub it
// down to the bare button so the fallthrough attrs the assertions use
// (data-testid, the click handler) still land where they did before.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs" />`,
	},
}))

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

vi.mock('frappe-ui', () => ({
	createListResource: createListResourceMock,
	createResource: () => ({
		data: [],
		reload: vi.fn(),
		update: vi.fn(),
		fetch: vi.fn(),
		loading: false,
	}),
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	FormLabel: {
		props: ['label', 'required', 'id'],
		template: `<label :for="id">{{ label }}</label>`,
	},
	Combobox: passthrough,
	MultiSelect: passthrough,
	Select: passthrough,
}))

vi.mock('@framework/ui/telemetry/index', async (importOriginal) => ({
	...(await importOriginal<typeof import('@framework/ui/telemetry/index')>()),
	useTelemetry: () => ({ capture: captureMock }),
}))
vi.mock(
	'@framework/ui/components/Onboarding/index',
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import('@framework/ui/components/Onboarding/index')
		>()),
		useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
	})
)

// The rich text editor drags in ProseMirror. A textarea that emits `change`
// is enough to fill the batch details the way the real editor does.
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({
		emits: ['change'],
		setup:
			(_props, { emit }) =>
			() =>
				h('textarea', {
					'data-testid': 'rich-text',
					onInput: (e: Event) =>
						emit('change', (e.target as HTMLTextAreaElement).value),
				}),
	}),
}))
vi.mock('@/components/Modals/NewMemberModal.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

import { toast } from 'frappe-ui'
import NewBatchForm from '@/pages/Forms/NewBatchForm.vue'

// The list page hosts the form as a child route, so it has to render a nested
// RouterView — otherwise the child never mounts. RouterView is imported rather
// than written as the string 'router-view', which h() would leave as an
// unresolved custom element.
const List = defineComponent({
	render: () => h('div', ['LIST', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches',
				name: 'Batches',
				component: List,
				children: [{ path: 'new', name: 'NewBatch', component: NewBatchForm }],
			},
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: List,
			},
		],
	})

const mountForm = async (router: Router, user: Record<string, unknown>) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`
			// access — it has to be on the instance too (see FormShell.test.ts).
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const moderator = { name: 'mod@example.com', is_moderator: true }
const student = {
	name: 'student@example.com',
	is_moderator: false,
	is_instructor: false,
	is_evaluator: false,
}

// Every field the batch form is meant to collect. The form was converted from a
// modal by moving this grid wholesale, so pin the set: a field dropped in the
// move is otherwise invisible to the rest of the suite.
const FIELD_LABELS = [
	'Title',
	'Start Date',
	'End Date',
	'Start Time',
	'End Time',
	'Timezone',
	'Category',
	'Seat Count',
	'Medium',
	'Description',
	'Instructors',
	'Batch Details',
]

const inputFor = (wrapper: VueWrapper, label: string) =>
	wrapper
		.findAll('label')
		.find((l) => l.text() === label)!
		.get('input')

// Fills every field LMS Batch requires.
const fillRequired = async (wrapper: VueWrapper): Promise<void> => {
	await inputFor(wrapper, 'Title').setValue('My batch')
	await inputFor(wrapper, 'Start Date').setValue('2026-11-01')
	await inputFor(wrapper, 'End Date').setValue('2026-11-30')
	await inputFor(wrapper, 'Start Time').setValue('10:00')
	await inputFor(wrapper, 'End Time').setValue('11:00')
	wrapper
		.findAllComponents(passthrough)
		.find((c) => c.props('label') === 'Timezone')!
		.vm.$emit('update:modelValue', 'Asia/Kolkata')
	await inputFor(wrapper, 'Description').setValue('Short')
	wrapper
		.findComponent({ name: 'MultiLink' })
		.vm.$emit('update:modelValue', ['mod@example.com'])
	await wrapper.get('[data-testid="rich-text"]').setValue('<p>Details</p>')
}

// Ctrl/Cmd+S is handled on window, but the handler ignores events whose target
// is not an HTMLElement — so this has to be dispatched from an element and
// allowed to bubble, or the test would pass without exercising the guard.
const pressCtrlS = (): void => {
	document.body.dispatchEvent(
		new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
	)
}

describe('NewBatchForm as a route', () => {
	beforeEach(() => {
		insertSubmit.mockReset()
		vi.mocked(toast.error).mockReset()
		createListResourceMock.mockClear()
		captureMock.mockReset()
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent list', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('New Batch')
	})

	it('reports where it was opened from, and what was filled when left', async () => {
		const { setFormSource } = await import('@/composables/formTracking')
		setFormSource('onboarding')
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		const wrapper = await mountForm(router, moderator)

		expect(captureMock).toHaveBeenCalledWith('batch_form_opened', {
			source: 'onboarding',
		})

		await wrapper.get('input').setValue('My batch')
		wrapper.unmount()

		const closed = captureMock.mock.calls.find(
			([event]) => event === 'batch_form_closed'
		)
		expect(closed?.[1].filled_fields).toEqual(['title'])
	})

	it('refuses to render the form for a user who cannot create batches', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		const wrapper = await mountForm(router, student)
		expect(wrapper.find('[data-testid="new-batch-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the batch form', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		const wrapper = await mountForm(router, moderator)

		const fields = wrapper.find('[data-testid="new-batch-fields"]')
		expect(fields.exists()).toBe(true)
		// InputLabel appends RequiredIndicator ("*" plus an sr-only "(required)"),
		// so the field's own name has to be read out of that.
		const labels = fields
			.findAll('label')
			.map((label) =>
				label
					.text()
					.replace(/\(required\)|\*/g, '')
					.replace(/\s+/g, ' ')
					.trim()
			)
			.filter((text) => text !== '')
		for (const label of FIELD_LABELS) {
			expect(labels).toContain(label)
		}
		// Exact count, so an added field has to be added here too.
		expect(labels).toHaveLength(FIELD_LABELS.length)
	})

	it('ignores Ctrl+S for a user who cannot create batches', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })

		// Control: the shortcut does reach saveBatch for a permitted user, so a
		// green refusal below cannot be the dispatch silently going nowhere.
		const permitted = await mountForm(router, moderator)
		await fillRequired(permitted)
		pressCtrlS()
		expect(insertSubmit).toHaveBeenCalledTimes(1)
		permitted.unmount()

		insertSubmit.mockReset()
		await mountForm(router, student)
		pressCtrlS()
		expect(insertSubmit).not.toHaveBeenCalled()
	})

	it('inserts through its own resource, not a parent-supplied one', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		const wrapper = await mountForm(router, moderator)
		await fillRequired(wrapper)

		await wrapper.find('[data-testid="new-batch-save"]').trigger('click')
		expect(insertSubmit).toHaveBeenCalledTimes(1)
	})

	// Regression: empty create showed a raw server error (#3024, fixed in
	// #3047).
	it('names the first missing field instead of sending an empty batch', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		const wrapper = await mountForm(router, moderator)
		const save = () =>
			wrapper.find('[data-testid="new-batch-save"]').trigger('click')

		await save()
		expect(insertSubmit).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenLastCalledWith('Add a Title before saving.')

		// Control: the same form, completed, reaches the server.
		await fillRequired(wrapper)
		await save()
		expect(insertSubmit).toHaveBeenCalledTimes(1)
	})

	// Regression: image-only batch details failed the required check (#3047
	// review).
	it('accepts batch details that are only an image', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		const wrapper = await mountForm(router, moderator)
		await fillRequired(wrapper)
		await wrapper
			.get('[data-testid="rich-text"]')
			.setValue('<p><img src="/files/a.png"></p>')

		await wrapper.find('[data-testid="new-batch-save"]').trigger('click')
		expect(toast.error).not.toHaveBeenCalled()
		expect(insertSubmit).toHaveBeenCalledTimes(1)
	})

	it('scopes its list resource to the SAME cache key Batches.vue uses', async () => {
		// The design doc (C4) records this as the single load-bearing reason a
		// created batch appears in the list at all: createListResource hands
		// back whichever instance was cached first under this key, so if this
		// key ever drifts from Batches.vue:167's, a save silently stops showing
		// up in the list with no test failing — until now.
		const router = makeRouter()
		await router.push({ name: 'NewBatch' })
		await mountForm(router, moderator)

		expect(createListResourceMock).toHaveBeenCalledWith(
			expect.objectContaining({ cache: ['batches', 'mod@example.com'] })
		)
	})

	it('mobile: the back control pops the router back to the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Batches' })
		await router.push({ name: 'NewBatch', state: { lmsFormEntry: true } })
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Batches')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({ name: 'Batches' })
		await router.push({ name: 'NewBatch', state: { lmsFormEntry: true } })
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Batches')
	})

	it('replaces rather than pushes on save, so Back reaches the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Batches' })
		await router.push({ name: 'NewBatch', state: { lmsFormEntry: true } })
		const wrapper = await mountForm(router, moderator)
		await fillRequired(wrapper)

		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: (d: unknown) => void }) => {
				options.onSuccess({ name: 'BATCH-0001' })
			}
		)
		await wrapper.find('[data-testid="new-batch-save"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BatchDetail')

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Batches')
	})
})
