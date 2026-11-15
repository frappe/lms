import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed } from 'vue'

const server = vi.hoisted(() => ({
	calls: [] as string[],
	settle: [] as (() => void)[],
	dialogs: [] as any[],
}))

const pending = (method: string) => {
	server.calls.push(method)
	return new Promise((resolve) => server.settle.push(() => resolve({})))
}

const settleAll = async () => {
	server.settle.splice(0).forEach((resolve) => resolve())
	await flushPromises()
}

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		call: (method: string) => pending(method),
		toast: { error: vi.fn(), success: vi.fn() },
		createResource: (options: { url: string }) => {
			const resource = reactive({
				loading: false,
				error: null,
				submit: () => {
					resource.loading = true
					return pending(options.url).finally(() => {
						resource.loading = false
					})
				},
			})
			return resource
		},
		Combobox: {
			props: ['modelValue', 'options', 'disabled'],
			emits: ['update:modelValue'],
			template: `<div :data-testid="$attrs['aria-label']" :data-disabled="disabled">
				<button
					v-for="o in options"
					:key="o.value"
					:data-option="o.value"
					@click="$emit('update:modelValue', o.value)"
				/>
			</div>`,
		},
	}
})

vi.mock('@/utils', () => ({ cleanError: (message: unknown) => message }))

vi.mock('@/utils/dialogs', () => ({
	createDialog: (options: unknown) => server.dialogs.push(options),
}))

vi.mock('@/components/Settings/Members/Members.vue', () => ({ default: {} }))

vi.mock('@/composables/useSettingsListResource', () => ({
	reloadSettingsLists: vi.fn(() => Promise.resolve()),
	useSettingsMethodResource: () => ({
		rows: [
			{
				name: 'EA-1',
				email_account_name: 'Support',
				enable_incoming: 1,
				enable_outgoing: 1,
			},
		],
		hasNextPage: false,
		loadMore: vi.fn(() => Promise.resolve()),
		reload: vi.fn(() => Promise.resolve()),
	}),
}))

vi.stubGlobal('__', (text: string) => ({
	format: () => text,
	toString: () => text,
}))

import EmailAccountDefaults from '@/components/Settings/EmailAccount/EmailAccountDefaults.vue'
import { confirmMemberDeletion } from '@/components/Settings/Members/members'
import { useWorkspaceGeneral } from '@/composables/raven/useWorkspaceGeneral'
import { EMAIL_ACCOUNT_METHODS } from '@/components/Settings/EmailAccount/emailAccounts'

beforeEach(() => {
	server.calls = []
	server.settle = []
	server.dialogs = []
})

describe('settings double submit', () => {
	it('sets a default email account once while the first pick is in flight', async () => {
		const wrapper = mount(EmailAccountDefaults, {
			global: { mocks: { __: (text: string) => text } },
		})
		await flushPromises()
		const box = wrapper.find('[data-testid="Default Incoming account"]')

		await box.find('[data-option="EA-1"]').trigger('click')
		expect(box.attributes('data-disabled')).toBe('true')
		await box.find('[data-option="EA-1"]').trigger('click')

		expect(server.calls).toEqual([EMAIL_ACCOUNT_METHODS.setDefault])
		await settleAll()
		expect(box.attributes('data-disabled')).toBe('false')
	})

	it('keeps the member delete dialog busy until the delete settles', async () => {
		confirmMemberDeletion({ name: 'a@example.com', full_name: 'A' }, vi.fn())
		const [{ actions }] = server.dialogs
		const close = vi.fn()

		const result = actions[0].onClick({ close })

		expect(result).toBeInstanceOf(Promise)
		expect(close).not.toHaveBeenCalled()
		await settleAll()
		await result
		expect(close).toHaveBeenCalledOnce()
		expect(server.calls).toEqual(['lms.lms.api.delete_member'])
	})

	it('creates a raven workspace once when Save is pressed twice', async () => {
		const form = useWorkspaceGeneral(
			computed(() => null),
			vi.fn(),
			{ isNew: () => true }
		)
		form.draft.label = 'Team'

		void form.save()
		void form.save()

		expect(server.calls).toEqual(['raven_integration.api.create_workspace'])
		await settleAll()
	})
})
