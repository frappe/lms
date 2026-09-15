import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type HistoryState,
	type Router,
} from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

// frappe-ui's internal module resolution doesn't work under vitest (see
// chapterForm.test.ts), so every export the form and FormShell pull in has to
// be stubbed by hand.
const { createResourceMock, getCachedListResourceMock, toastMock } = vi.hoisted(
	() => {
		window.matchMedia ??= (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia
		return {
			createResourceMock: vi.fn(),
			getCachedListResourceMock: vi.fn(),
			toastMock: { success: vi.fn(), error: vi.fn() },
		}
	}
)

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

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	getCachedListResource: getCachedListResourceMock,
	toast: toastMock,
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
		props: ['modelValue', 'label', 'type', 'placeholder', 'required'],
		emits: ['update:modelValue'],
		template: `<label :data-testid="'field-' + label">{{ label }}
			<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
		</label>`,
	},
}))

// @/utils is the barrel that pulls in plyr and the settings store; only
// cleanError is used here.
vi.mock('@/utils', () => ({ cleanError: (msg: string) => msg }))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'size'],
		emits: ['update:modelValue'],
		template: `<button data-testid="use-html" @click="$emit('update:modelValue', !modelValue)">{{ label }}</button>`,
	},
}))

vi.mock('@/components/RichTextEditor.vue', () => ({
	default: {
		props: ['content', 'editable', 'fixedMenu', 'placeholder', 'editorClass'],
		emits: ['change'],
		template: `<div data-testid="rich-text" @click="$emit('change', 'Dear member')" />`,
	},
}))

// @ts-expect-error a JS SFC has no generated types (TS7016) — the same gap
// every test importing a non-`lang="ts"` component in this suite hits.
import EmailTemplateForm from '@/pages/Forms/EmailTemplateForm.vue'

const insert = reactive({ loading: false, submit: vi.fn() })
createResourceMock.mockImplementation(() => insert)

const insertOptions = (): Record<string, unknown> =>
	(
		createResourceMock.mock.calls.find(
			(call) => (call[0] as { url: string }).url === 'frappe.client.insert'
		) as [Record<string, unknown>]
	)[0]

// The parent page is a route component too, so it has to render a nested
// RouterView or the child never mounts.
const BatchPage = defineComponent({
	render: () => h('div', ['BATCH', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: BatchPage,
				props: true,
				children: [
					{
						path: 'email-template/new',
						name: 'NewBatchEmailTemplate',
						component: EmailTemplateForm,
						props: true,
					},
				],
			},
		],
	})

const moderator = { name: 'mod@example.com', is_moderator: true }
const evaluator = { name: 'eval@example.com', is_evaluator: true }
const outsider = { name: 'someone@example.com' }

// The Link that opens this form lives on BatchForm, which is the settings tab.
const BATCH_TAB = '#settings'

const openForm = (router: Router, state?: HistoryState) =>
	router.push({
		name: 'NewBatchEmailTemplate',
		params: { batchName: 'B1' },
		hash: BATCH_TAB,
		state,
	})

const mountForm = async (
	router: Router,
	user: Record<string, unknown> | null = moderator
) => {
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

const fields = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="email-template-fields"]')

const save = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="email-template-save"]')

const fill = async (wrapper: ReturnType<typeof mount>) => {
	await wrapper
		.find('[data-testid="field-Name"] input')
		.setValue('Enrollment Confirmation')
	await wrapper
		.find('[data-testid="field-Subject"] input')
		.setValue('You are in')
	await wrapper.find('[data-testid="rich-text"]').trigger('click')
}

const succeedOnSubmit = () => {
	insert.submit.mockImplementation(
		(_params: unknown, options: { onSuccess: () => void }) => {
			options.onSuccess()
		}
	)
}

describe('EmailTemplateForm as a route', () => {
	beforeEach(() => {
		insert.submit.mockReset()
		insert.loading = false
		createResourceMock.mockClear()
		getCachedListResourceMock.mockReset()
		getCachedListResourceMock.mockReturnValue(null)
		toastMock.success.mockReset()
		toastMock.error.mockReset()
		delete (window as Window & { read_only_mode?: boolean }).read_only_mode
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	// The whole point of the conversion: BatchForm owned the list resource this
	// used to insert through, and on a deep link no settings tab is mounted at
	// all — so the page has to stand up with no parent behind it.
	it('mounts straight from the URL with no BatchForm mounted', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(wrapper.text()).toContain('BATCH')
		expect(fields(wrapper).exists()).toBe(true)
		expect(wrapper.html()).toContain('New Email Template')
	})

	it('refuses a visitor who is neither moderator nor evaluator', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, outsider)

		expect(fields(wrapper).exists()).toBe(false)
		expect(save(wrapper).exists()).toBe(false)
		expect(wrapper.html()).toContain('do not have permission')
	})

	// The settings tab that hosted the modal was gated on moderator OR
	// evaluator, both from $user alone — so this page needs no batch fetch to
	// judge the visitor.
	it('lets a batch evaluator through', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, evaluator)

		expect(fields(wrapper).exists()).toBe(true)
	})

	it('refuses everyone on a read-only site', async () => {
		;(window as Window & { read_only_mode?: boolean }).read_only_mode = true
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(fields(wrapper).exists()).toBe(false)
		expect(wrapper.html()).toContain('read-only')
	})

	it('inserts through its own resource, naming by prompt', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await fill(wrapper)

		await save(wrapper).trigger('click')
		expect(insert.submit).toHaveBeenCalledTimes(1)
		expect((insertOptions().makeParams as () => unknown)()).toEqual({
			doc: {
				doctype: 'Email Template',
				__newname: 'Enrollment Confirmation',
				name: 'Enrollment Confirmation',
				subject: 'You are in',
				use_html: 0,
				response: 'Dear member',
				response_html: '',
			},
		})
	})

	it('sends the HTML body instead once Use HTML is on', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await wrapper.find('[data-testid="field-Name"] input').setValue('Plain')
		await wrapper.find('[data-testid="use-html"]').trigger('click')
		await wrapper.find('[data-testid="field-Content"] input').setValue('<p>Hi')

		expect((insertOptions().makeParams as () => unknown)()).toMatchObject({
			doc: { use_html: 1, response_html: '<p>Hi', response: '' },
		})
	})

	it('hands the created name back to BatchForm through the URL', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await fill(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.hash).toBe(BATCH_TAB)
		expect(router.currentRoute.value.query.emailTemplate).toBe(
			'Enrollment Confirmation'
		)
	})

	// A typed-in URL carries no hash, and TabbedDetailPage resolves an empty
	// hash to tab 0 (Overview). BatchForm only exists on the settings tab, so
	// returning without a hash would leave the adopter unmounted: the template
	// is created, confirmation_email_template is silently never set, and the
	// handback sits in the URL until the user opens Settings, where it applies
	// itself and trips the dirty-autosave with no user action behind it.
	it('returns to the settings tab when deep-linked without a hash', async () => {
		const router = makeRouter()
		await router.push({
			name: 'NewBatchEmailTemplate',
			params: { batchName: 'B1' },
		})
		const wrapper = await mountForm(router)
		await fill(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.hash).toBe(BATCH_TAB)
		expect(router.currentRoute.value.query.emailTemplate).toBe(
			'Enrollment Confirmation'
		)
	})

	it('survives a save with no template list mounted to refresh', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await fill(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(getCachedListResourceMock).toHaveBeenCalledWith('email-templates')
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	it('refreshes the settings template list when it is mounted', async () => {
		const list = { reload: vi.fn() }
		getCachedListResourceMock.mockReturnValue(list)
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await fill(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(list.reload).toHaveBeenCalledTimes(1)
	})

	it('mobile: the back control pops the router back to the batch', async () => {
		const router = makeRouter()
		await router.push({
			name: 'BatchDetail',
			params: { batchName: 'B1' },
			hash: BATCH_TAB,
		})
		await openForm(router, { lmsFormEntry: true })
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.hash).toBe(BATCH_TAB)
	})
})
