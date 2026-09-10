/**
 * GoogleApiSettings: the one rule that matters is that `client_secret` never
 * reaches `frappe.client.set_value` unless the user actually typed a new one.
 * `client_secret` loads as Frappe's dummy mask or empty — never the real
 * value — and sending an empty string wipes it server-side
 * (`_save_passwords()` calls `remove_encrypted_password` on a falsy value).
 * These are the tests that would have caught that, run against the guard
 * broken exactly the way it would break by accident (see the note on the
 * mutation-tested case below).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { call, toast, saveMock } = vi.hoisted(() => ({
	call: vi.fn(() => Promise.resolve({})),
	toast: { success: vi.fn(), error: vi.fn() },
	saveMock: vi.fn(() => Promise.resolve({})),
}))

vi.mock('frappe-ui', () => ({
	call,
	toast,
	FormControl: {
		props: ['modelValue', 'type', 'placeholder', 'ariaLabel'],
		emits: ['update:modelValue'],
		template: `<input
			:type="type"
			:placeholder="placeholder"
			:value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)"
		/>`,
	},
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'size', 'ariaLabel'],
		emits: ['update:modelValue'],
		template: `<button data-testid="enable-switch" :data-value="String(modelValue)" @click="$emit('update:modelValue', !modelValue)" />`,
	},
}))

vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: {
		emits: ['save'],
		props: [
			'title',
			'description',
			'unsaved',
			'saveLabel',
			'saving',
			'canSave',
			'saveTestid',
		],
		template: `<div>
			<button v-if="saveLabel" :data-testid="saveTestid" :disabled="!canSave" @click="$emit('save')">{{ saveLabel }}</button>
			<slot />
		</div>`,
	},
}))

// A minimal stand-in: a reactive `doc` the test seeds directly, an `isDirty`
// the test drives, and the real save() distinguishes from the component's own
// client_secret handling by never touching that field itself.
let sourceDoc: Record<string, unknown>
vi.mock('@/composables/useSettingsSource', async () => {
	const { reactive, ref } = await import('vue')
	return {
		useSettingsSource: () =>
			reactive({
				doc: sourceDoc,
				// Fixed true: these tests are about what save() sends for
				// client_secret, not about the button's enabled state, and a
				// disabled Save (a real <button disabled>) would make every click
				// below a no-op instead of exercising the guard.
				isDirty: true,
				isNew: false,
				name: 'Google Settings',
				save: saveMock,
				reload: vi.fn(),
			}),
	}
})

import GoogleApiSettings from '@/components/Settings/GoogleApi/GoogleApiSettings.vue'

const mountPage = () =>
	mount(GoogleApiSettings, {
		global: { mocks: { __: (text: string) => text } },
	})

describe('GoogleApiSettings', () => {
	beforeEach(() => {
		call.mockClear()
		saveMock.mockClear()
		sourceDoc = { enable: 1, client_id: 'abc', client_secret: '*****' }
	})

	it('never sends client_secret when the field was never touched', async () => {
		const wrapper = mountPage()
		await wrapper.find('[data-testid="google-api-save"]').trigger('click')
		await flushPromises()

		expect(saveMock).toHaveBeenCalled()
		expect(call).not.toHaveBeenCalled()
	})

	it('sends the typed value when the user edits the secret', async () => {
		const wrapper = mountPage()
		await wrapper.find('input[type="password"]').setValue('a-new-secret')
		await wrapper.find('[data-testid="google-api-save"]').trigger('click')
		await flushPromises()

		expect(call).toHaveBeenCalledWith('frappe.client.set_value', {
			doctype: 'Google Settings',
			name: 'Google Settings',
			fieldname: 'client_secret',
			value: 'a-new-secret',
		})
	})

	// Mutation control: the shape of the actual bug this guards against is
	// "the secret box mirrors source.doc.client_secret directly" — which
	// would submit the loaded mask or, worse, an empty string the instant the
	// field is cleared. This asserts the box does NOT come from source.doc at
	// all, so a future edit that wires it back up that way fails here first.
	it('does not seed the secret box from the loaded (masked) value', () => {
		sourceDoc = { enable: 1, client_id: 'abc', client_secret: '*****' }
		const wrapper = mountPage()
		const input = wrapper.find('input[type="password"]')
		expect((input.element as HTMLInputElement).value).toBe('')
	})
})
