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

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { batchResource, announcementSubmit, createResourceMock } = vi.hoisted(
	() => ({
		batchResource: {
			data: null as Record<string, unknown> | null,
			loading: false,
			fetched: true,
			reload: () => {},
		},
		announcementSubmit: vi.fn(),
		createResourceMock: vi.fn(),
	})
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
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
}))

// The rich text editor drags in ProseMirror and is uncontrolled here by design.
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({
		name: 'RichTextEditor',
		emits: ['change'],
		render: () => h('div', { class: 'editor' }),
	}),
}))

// @ts-expect-error a JS SFC has no generated types (TS7016) — the same gap
// every test importing a non-`lang="ts"` component in this suite hits.
import AnnouncementForm from '@/pages/Forms/AnnouncementForm.vue'

const BATCH_URL = 'lms.lms.utils.get_batch_details'
const EMAIL_URL = 'frappe.core.doctype.communication.email.make'

const Parent = defineComponent({
	render: () => h('div', ['BATCH', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: Parent,
				props: true,
				children: [
					{
						path: 'announcement/new',
						name: 'NewAnnouncement',
						component: AnnouncementForm,
						props: true,
					},
				],
			},
		],
	})

const mountForm = async (router: Router, user: Record<string, unknown>) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const moderator = { name: 'mod@example.com', is_moderator: true }
const student = { name: 'student@example.com' }

const FIELD_LABELS = ['Subject', 'Reply To', 'Announcement']

describe('AnnouncementForm as a route', () => {
	beforeEach(() => {
		announcementSubmit.mockReset()
		createResourceMock.mockReset()
		createResourceMock.mockImplementation((options: { url: string }) =>
			options.url === BATCH_URL
				? batchResource
				: { submit: announcementSubmit, loading: false, data: null }
		)
		batchResource.data = {
			name: 'B1',
			students: ['a@example.com', 'b@example.com'],
		}
		batchResource.loading = false
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent page mounted', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('Make an Announcement')
		expect(wrapper.find('[data-testid="announcement-fields"]').exists()).toBe(
			true
		)
	})

	it('fetches its own batch context for the batch in the URL', async () => {
		// The BCC student list comes from get_batch_details. This is the form's
		// OWN fetch — BatchDetail's resource carries no cache key, so there is no
		// instance to share and none is claimed.
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		await mountForm(router, moderator)
		const batchCall = createResourceMock.mock.calls.find(
			(call) => call[0].url === BATCH_URL
		)
		expect(batchCall).toBeDefined()
		expect(batchCall?.[0].cache).toBeUndefined()
		expect(batchCall?.[0].makeParams()).toEqual({ batch: 'B1' })
	})

	it('BCCs the batch students it fetched, not a prop', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		await mountForm(router, moderator)
		const emailCall = createResourceMock.mock.calls.find(
			(call) => call[0].url === EMAIL_URL
		)
		expect(emailCall?.[0].makeParams()).toMatchObject({
			bcc: 'a@example.com, b@example.com',
			name: 'B1',
		})
	})

	it('refuses for a user who is not a batch admin', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, student)
		expect(wrapper.find('[data-testid="announcement-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('refuses when the batch has no students to announce to', async () => {
		batchResource.data = { name: 'B1', students: [] }
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.find('[data-testid="announcement-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('Add students to the batch')
	})

	it('carries every field of the announcement form', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, moderator)

		const fields = wrapper.find('[data-testid="announcement-fields"]')
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
		for (const label of FIELD_LABELS) expect(labels).toContain(label)
		expect(labels).toHaveLength(FIELD_LABELS.length)
		expect(fields.find('.editor').exists()).toBe(true)
	})

	// Filling the form is load-bearing now that the submit goes through
	// submitResource: validation runs in OUR code before the resource is
	// touched, where the createResource mock used to swallow the `validate`
	// option and let an empty form through.
	const fillAnnouncement = async (wrapper: VueWrapper) => {
		const inputs = wrapper
			.find('[data-testid="announcement-fields"]')
			.findAll('input')
		await inputs[0].setValue('Exam on Friday')
		await inputs[1].setValue('teacher@example.com')
		await wrapper
			.findComponent({ name: 'RichTextEditor' })
			.vm.$emit('change', '<p>Bring a pencil.</p>')
		await flushPromises()
	}

	it('sends through its own resource', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, moderator)
		await fillAnnouncement(wrapper)
		await wrapper.find('[data-testid="announcement-save"]').trigger('click')
		expect(announcementSubmit).toHaveBeenCalledTimes(1)
	})

	it('refuses to send an empty announcement', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, moderator)
		await wrapper.find('[data-testid="announcement-save"]').trigger('click')
		expect(announcementSubmit).not.toHaveBeenCalled()
	})

	it('mobile: the back control pops the router back to the page', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#announcements')
		await router.push({
			name: 'NewAnnouncement',
			params: { batchName: 'B1' },
			hash: '#announcements',
			state: { lmsFormEntry: true },
		})
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router, moderator)
		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#announcements')
	})

	it('desktop: dismissing the Dialog pops the router back to the page', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#announcements')
		await router.push({
			name: 'NewAnnouncement',
			params: { batchName: 'B1' },
			hash: '#announcements',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)
		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	it('closing a DEEP-LINKED form keeps the tab hash (C2)', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new#announcements')
		const wrapper = await mountForm(router, moderator)
		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#announcements')
	})
})
