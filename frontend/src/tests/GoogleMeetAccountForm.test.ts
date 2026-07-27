/**
 * Tests for GoogleMeetAccountForm.vue — the settings panel is mounted fresh
 * every time it is opened (GoogleMeetSettings toggles it with v-if/v-else), so
 * the form has to seed itself from the selected account on mount, not only when
 * `accountID` later changes.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GoogleMeetAccountForm from '@/components/Settings/GoogleMeetAccountForm.vue'

const { callMock, toastMock, captureMock } = vi.hoisted(() => ({
	callMock: vi.fn(() => Promise.resolve()),
	toastMock: { success: vi.fn(), error: vi.fn() },
	captureMock: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: toastMock,
	Button: {
		props: ['variant'],
		emits: ['click'],
		template: `<button data-testid="save" @click="$emit('click')"><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<input :data-testid="'field-' + label" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
}))

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: captureMock }),
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: {
		props: ['title', 'description', 'showBack'],
		template: `<div><h1 data-testid="title">{{ title }}</h1><slot name="header-actions" /><slot /></div>`,
	},
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'size'],
		emits: ['update:modelValue'],
		template: `<button :data-testid="'switch-' + modelValue" @click="$emit('update:modelValue', !modelValue)" />`,
	},
}))

vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'doctype', 'onCreate', 'required'],
		emits: ['update:modelValue'],
		template: `<input :data-testid="'field-' + label" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
}))

// @/utils pulls in plyr, which touches window.matchMedia at import time.
vi.mock('@/utils', () => ({
	cleanError: (e: unknown) => e,
	openSettings: vi.fn(),
}))

vi.stubGlobal('__', (s: string) => s)

// `autoname: field:account_name`, so name and account_name always match.
const ACCOUNT = {
	name: 'Meet Account 1',
	account_name: 'Meet Account 1',
	enabled: true,
	member: 'evaluator@test.com',
	google_calendar: 'Primary Calendar',
}

function mountForm(accountID: string) {
	const insertSubmit = vi.fn()
	const setValueSubmit = vi.fn()
	const reload = vi.fn()
	const wrapper = mount(GoogleMeetAccountForm, {
		props: {
			accountID,
			googleMeetAccounts: {
				data: [{ ...ACCOUNT }],
				reload,
				insert: { submit: insertSubmit },
				setValue: { submit: setValueSubmit },
			},
		},
		global: {
			provide: { $user: { data: { name: 'admin@test.com' } } },
			mocks: { __: (s: string) => s },
		},
	})
	return { wrapper, insertSubmit, setValueSubmit, reload }
}

const fieldValue = (wrapper: any, label: string) =>
	(wrapper.find(`[data-testid="field-${label}"]`).element as HTMLInputElement)
		.value

beforeEach(() => {
	callMock.mockClear()
	toastMock.success.mockClear()
	toastMock.error.mockClear()
})

describe('GoogleMeetAccountForm', () => {
	it('seeds the form with the selected account on mount', () => {
		const { wrapper } = mountForm(ACCOUNT.name)

		expect(wrapper.find('[data-testid="title"]').text()).toBe(
			'Edit Google Meet Account'
		)
		expect(fieldValue(wrapper, 'Account Name')).toBe(ACCOUNT.name)
		expect(fieldValue(wrapper, 'Member')).toBe(ACCOUNT.member)
		expect(fieldValue(wrapper, 'Google Calendar')).toBe(ACCOUNT.google_calendar)
		expect(wrapper.find('[data-testid="switch-true"]').exists()).toBe(true)
	})

	it('saving an untouched account updates it without renaming', async () => {
		const { wrapper, setValueSubmit } = mountForm(ACCOUNT.name)

		await wrapper.find('[data-testid="save"]').trigger('click')
		await flushPromises()

		expect(callMock).not.toHaveBeenCalled()
		expect(setValueSubmit).toHaveBeenCalledTimes(1)
		expect(setValueSubmit.mock.calls[0][0]).toMatchObject({
			name: ACCOUNT.name,
			member: ACCOUNT.member,
			google_calendar: ACCOUNT.google_calendar,
		})
	})

	it('starts blank for a new account', () => {
		const { wrapper } = mountForm('new')

		expect(wrapper.find('[data-testid="title"]').text()).toBe(
			'New Google Meet Account'
		)
		expect(fieldValue(wrapper, 'Account Name')).toBe('')
		expect(fieldValue(wrapper, 'Member')).toBe('admin@test.com')
		expect(fieldValue(wrapper, 'Google Calendar')).toBe('')
	})
})
