/**
 * Tests for the "Assign For" field on the badge form.
 *
 * frappe-ui's Combobox models a plain value — `defineModel<string | null>` — so
 * `update:modelValue` carries the selected option's value, not the option
 * object. BadgeForm read `opt.value` off it, which is `undefined` on a string,
 * so picking a doctype silently cleared the field and every badge saved without
 * the one thing that decides what it is awarded for.
 *
 * LMS Badge marks reference_doctype reqd=1, so the control says so too.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

window.__ = (text: string): string => text

const { insertSubmit, setValueSubmit, reloadMock, toastMock, callMock } =
	vi.hoisted(() => ({
		insertSubmit: vi.fn(),
		setValueSubmit: vi.fn(),
		reloadMock: vi.fn(),
		toastMock: { success: vi.fn(), error: vi.fn() },
		callMock: vi.fn(() => Promise.resolve({})),
	}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: toastMock,
	Button: {
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<input
			:data-testid="'fc-' + label"
			:value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)"
		/>`,
	},
	// Mirrors the real component's contract: the payload is the option's VALUE.
	Combobox: {
		props: ['modelValue', 'options', 'label', 'required'],
		emits: ['update:modelValue'],
		template: `<button
			data-testid="combobox"
			:data-required="required ? 'yes' : 'no'"
			@click="$emit('update:modelValue', options[0].value)"
		/>`,
	},
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'size', 'description'],
		emits: ['update:modelValue'],
		template: `<div data-testid="switch" />`,
	},
}))
vi.mock('frappe-ui/code-editor', () => ({
	// Real module pulls in CodeMirror. This suite only checks what the badge
	// form sends.
	CodeEditor: {
		props: ['modelValue', 'extensions', 'editable'],
		emits: ['update:modelValue', 'change'],
		template: `<button
			data-testid="code"
			:data-value="modelValue"
			@click="$emit('update:modelValue', 'doc.progress == 100')"
		/>`,
	},
	CodeEditorContent: { template: '<div />' },
	CodeKit: { configure: () => ({}) },
	loadLanguage: async () => ({}),
}))
vi.mock('@/components/Controls/Uploader.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'required'],
		emits: ['update:modelValue'],
		template: `<div data-testid="uploader" />`,
	},
}))
vi.mock('@/components/Controls/Select.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'options', 'required'],
		emits: ['update:modelValue'],
		template: `<div data-testid="select" />`,
	},
}))
vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: {
		props: ['title', 'showBack', 'enabled'],
		template: `<div><slot name="header-actions" /><slot /></div>`,
	},
}))
vi.mock('@/utils', () => ({ cleanError: (e: unknown) => String(e) }))

import BadgeForm from '@/components/Settings/Badges/BadgeForm.vue'

const mountForm = (badgeName = 'new') =>
	mount(BadgeForm, {
		props: {
			badgeName,
			badges: {
				data: [],
				insert: { submit: insertSubmit },
				setValue: { submit: setValueSubmit },
				reload: reloadMock,
			} as any,
		},
		global: { config: { globalProperties: { __: (s: string) => s } as any } },
	})

describe('BadgeForm — Assign For', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('puts the picked doctype in the created badge', async () => {
		const wrapper = mountForm()

		await wrapper.find('[data-testid="combobox"]').trigger('click')
		await wrapper.find('button:not([data-testid])').trigger('click')
		await flushPromises()

<<<<<<< HEAD
		expect(insertSubmit).toHaveBeenCalled()
		expect(insertSubmit.mock.calls[0][0]).toMatchObject({
			reference_doctype: 'LMS Course',
		})
	})

	it('marks Assign For required, as LMS Badge does', () => {
		const wrapper = mountForm()

		expect(
			wrapper.find('[data-testid="combobox"]').attributes('data-required')
		).toBe('yes')
=======
// Either control: Description is a textarea and the rest are inputs. Both
// halves are scoped to the testid, because a bare `, textarea` would match any
// textarea on the page.
const control = (label: string) =>
	`[aria-label="${label}"] input, [aria-label="${label}"] textarea`

const field = (wrapper: Wrapper, testid: string) => wrapper.get(control(testid))

const valueOf = (wrapper: Wrapper, testid: string) =>
	(wrapper.get(control(testid)).element as HTMLInputElement).value

const save = (wrapper: Wrapper) =>
	wrapper.get('[data-testid="settings-fields-save"]').trigger('click')

beforeEach(() => {
	vi.clearAllMocks()
	rows.length = 0
	rows.push({ ...champion })
	saveMock.mockResolvedValue({ name: 'Champion' })
})

describe('the top of the badge form is editable', () => {
	it('uploads a new picture onto the badge', async () => {
		const wrapper = await openBadge(mountPage())

		await wrapper.get('[data-testid="uploaded"]').trigger('click')

		expect(wrapper.get('img').attributes('src')).toBe('/files/badge.png')
	})
})

describe('opening a badge', () => {
	it('fills every field from the record', async () => {
		const wrapper = await openBadge(mountPage())

		expect(valueOf(wrapper, 'Title')).toBe('Champion')
		expect(valueOf(wrapper, 'Description')).toBe('Finished a course')
		expect(
			wrapper.get('[aria-label="Assign For"]').attributes('data-value')
		).toBe('LMS Batch')
		expect(
			wrapper.get('[aria-label="Assign To"]').attributes('data-value')
		).toBe('owner')
		expect(wrapper.get('[aria-label="Event"]').attributes('data-value')).toBe(
			'Value Change'
		)
		expect(wrapper.get('[data-testid="code"]').attributes('data-value')).toBe(
			'doc.status == "Complete"'
		)
		expect(wrapper.get('img').attributes('src')).toBe('/files/champion.png')
	})

	it('opens a new badge on the doctype defaults', async () => {
		const wrapper = await openNew(mountPage())

		expect(wrapper.get('[data-title]').attributes('data-title')).toBe(
			'New Badge'
		)
		expect(valueOf(wrapper, 'Title')).toBe('')
		expect(wrapper.get('[aria-label="Event"]').attributes('data-value')).toBe(
			'New'
		)
		expect(
			wrapper.get('[aria-label="Assign To"]').attributes('data-value')
		).toBe('member')
	})
})

describe('save is offered only for something to save', () => {
	it('disables Save on a badge nothing has been done to', async () => {
		const wrapper = await openBadge(mountPage())

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeDefined()
		expect(wrapper.find('[data-testid="badge-discard"]').exists()).toBe(false)
	})

	it('arms Save once a field changes, and still offers no Discard', async () => {
		const wrapper = await openBadge(mountPage())

		await field(wrapper, 'Title').setValue('Renamed')

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeUndefined()
		expect(wrapper.find('[data-testid="badge-discard"]').exists()).toBe(false)
	})

	it('disables Save on a new badge until something is typed', async () => {
		const wrapper = await openNew(mountPage())

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeDefined()

		await field(wrapper, 'Title').setValue('Champion II')

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeUndefined()
	})

	it('marks the header unsaved while there is an edit outstanding', async () => {
		const wrapper = await openBadge(mountPage())
		expect(wrapper.get('[data-unsaved]').attributes('data-unsaved')).toBe('no')

		await field(wrapper, 'Title').setValue('Renamed')

		expect(wrapper.get('[data-unsaved]').attributes('data-unsaved')).toBe('yes')
	})
})

describe('saving', () => {
	it('writes the record and goes back to the list', async () => {
		const wrapper = await openBadge(mountPage())

		await field(wrapper, 'Title').setValue('Renamed')
		await save(wrapper)
		await flushPromises()

		expect(saveMock).toHaveBeenCalled()
		expect(listReload).toHaveBeenCalled()
		expect(wrapper.find('[data-testid="list"]').exists()).toBe(true)
	})

	it('names the first missing field rather than sending an empty badge', async () => {
		const wrapper = await openNew(mountPage())

		await field(wrapper, 'Description').setValue('Won it')
		await save(wrapper)
		await flushPromises()

		expect(saveMock).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledWith('Title is required')
>>>>>>> ffe35ba (test: drop mocked frontend tests that only pin wiring or markup)
	})
})
