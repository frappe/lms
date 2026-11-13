import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { batchResource, announcementSubmit, createResourceMock, toastWarning } =
	vi.hoisted(() => ({
		batchResource: {
			data: null as Record<string, unknown> | null,
			loading: false,
			fetched: true,
			reload: () => {},
		},
		announcementSubmit: vi.fn(),
		createResourceMock: vi.fn(),
		toastWarning: vi.fn(),
	}))

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

// `FormLayout` (and its `TextField`/`TextInput`) is the real library now, so
// only the pieces this suite controls, plus the Dialog FormShell needs a light
// stub for, are replaced. Everything else (Tabs, TextInput, …) is real.
vi.mock('frappe-ui', async () => {
	const actual = await vi.importActual<typeof import('frappe-ui')>('frappe-ui')
	return {
		...actual,
		createResource: createResourceMock,
		toast: { success: vi.fn(), error: vi.fn(), warning: toastWarning },
		Dialog: {
			name: 'Dialog',
			props: ['open', 'title', 'size'],
			emits: ['update:open'],
			template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
		},
	}
})

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
const EMAIL_URL = 'lms.lms.api.send_batch_announcement'

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

describe('AnnouncementForm as a route', () => {
	beforeEach(() => {
		announcementSubmit.mockReset()
		createResourceMock.mockReset()
		createResourceMock.mockImplementation((options: { url: string }) =>
			options.url === BATCH_URL
				? batchResource
				: { submit: announcementSubmit, loading: false, data: null },
		)
		batchResource.data = { name: 'B1', student_count: 2 }
		batchResource.loading = false
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	// The students' addresses never reach the client: the server BCCs them.
	it('sends the batch, not a student list, to the server', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		await mountForm(router, moderator)
		const emailCall = createResourceMock.mock.calls.find(
			(call) => call[0].url === EMAIL_URL,
		)
		const params = emailCall?.[0].makeParams()
		expect(params).toMatchObject({ batch: 'B1' })
		expect(params).not.toHaveProperty('bcc')
	})

	it('refuses for a user who is not a batch admin', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, student)
		expect(wrapper.find('[data-testid="announcement-fields"]').exists()).toBe(
			false,
		)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('leaves with a toast when the batch has no students', async () => {
		toastWarning.mockReset()
		batchResource.data = { name: 'B1', student_count: 0 }
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
		expect(toastWarning).toHaveBeenCalledWith(
			'Add students to the batch to make an announcement',
		)
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	it('refuses to send an empty announcement', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new')
		const wrapper = await mountForm(router, moderator)
		await wrapper.find('[data-testid="announcement-save"]').trigger('click')
		expect(announcementSubmit).not.toHaveBeenCalled()
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
