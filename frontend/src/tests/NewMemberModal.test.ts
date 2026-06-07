/**
 * Tests for NewMemberModal.vue — the single component reused for BOTH adding a
 * new member and editing an existing member's roles.
 *
 * The goal is to pin every branch: add vs edit, required-email, the role
 * allocation on add, and (most importantly) the role-DIFF on edit — only
 * changed roles should hit `save_role`, with the correct value, and a no-op
 * edit should still succeed without any network calls.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'

// frappe-ui's internal module resolution doesn't work under vitest, and we want
// to drive the Dialog's action button + observe `call`/`toast`. Hoisted so the
// mock factory and the tests share the same spies.
const { callMock, toastMock, closeMock } = vi.hoisted(() => ({
	callMock: vi.fn(),
	toastMock: { success: vi.fn(), error: vi.fn() },
	closeMock: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: toastMock,
	Dialog: {
		props: ['modelValue', 'options'],
		setup() {
			return { closeMock }
		},
		template: `
			<div v-if="modelValue">
				<div data-testid="title">{{ options.title }}</div>
				<slot name="body-content" />
				<button
					v-for="a in options.actions"
					:key="a.label"
					:data-testid="'action-' + a.label"
					@click="a.onClick({ close: closeMock })"
				>{{ a.label }}</button>
			</div>
		`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'disabled', 'required'],
		emits: ['update:modelValue'],
		template: `
			<input
				:data-testid="'field-' + label"
				:type="type"
				:disabled="disabled"
				:data-required="required ? 'true' : 'false'"
				:value="modelValue"
				@input="$emit('update:modelValue', $event.target.value)"
			/>
		`,
	},
}))

vi.mock('@/components/Controls/Switch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'size'],
		emits: ['update:modelValue'],
		template: `
			<button
				:data-testid="'role-' + label"
				:data-checked="modelValue ? 'true' : 'false'"
				@click="$emit('update:modelValue', !modelValue)"
			/>
		`,
	},
}))

vi.mock('@/utils', () => ({ cleanError: (e: unknown) => e }))

// `__` (translation) is a bare global used in the component's <script>, not just
// its template, so it needs to exist on the global scope.
vi.stubGlobal('__', (s: string) => s)

const mountModal = (props: Record<string, unknown> = {}) =>
	mount(NewMemberModal, {
		props: { modelValue: false, ...props },
		global: { mocks: { __: (s: string) => s } },
	})

// Open by transitioning modelValue false -> true so the component's
// watch(show) runs (it has no `immediate`).
const open = async (wrapper: ReturnType<typeof mountModal>) => {
	await wrapper.setProps({ modelValue: true })
	await flushPromises()
}

const clickAction = async (
	wrapper: ReturnType<typeof mountModal>,
	label: string
) => {
	await wrapper.get(`[data-testid="action-${label}"]`).trigger('click')
	await flushPromises()
}

const saveRoleCalls = () =>
	callMock.mock.calls.filter((c) => c[0] === 'lms.lms.api.save_role')

beforeEach(() => {
	callMock.mockReset()
	callMock.mockResolvedValue(true)
	toastMock.success.mockReset()
	toastMock.error.mockReset()
	closeMock.mockReset()
})

describe('NewMemberModal — add mode', () => {
	it('shows add title/action, visible name fields, editable required email', async () => {
		const w = mountModal()
		await open(w)
		expect(w.get('[data-testid="title"]').text()).toBe('Add New Member')
		expect(w.find('[data-testid="action-Add"]').exists()).toBe(true)
		expect(w.find('[data-testid="field-First Name"]').exists()).toBe(true)
		const email = w.get('[data-testid="field-Email"]')
		expect(email.attributes('disabled')).toBeUndefined()
		expect(email.attributes('data-required')).toBe('true')
	})

	it('blocks submit and toasts when email is empty (no network)', async () => {
		const w = mountModal()
		await open(w)
		await clickAction(w, 'Add')
		expect(toastMock.error).toHaveBeenCalledWith('Email is required')
		expect(callMock).not.toHaveBeenCalled()
		expect(closeMock).not.toHaveBeenCalled()
	})

	it('inserts the user then assigns only the selected roles, emits created, closes', async () => {
		const w = mountModal()
		await open(w)
		callMock.mockResolvedValueOnce({ name: 'jane@doe.com' }) // insert
		await w
			.get('[data-testid="field-Email"]')
			.setValue('jane@doe.com')
		await w.get('[data-testid="role-Moderator"]').trigger('click')
		await clickAction(w, 'Add')

		expect(callMock).toHaveBeenCalledWith('frappe.client.insert', {
			doc: {
				doctype: 'User',
				email: 'jane@doe.com',
				first_name: undefined,
				last_name: undefined,
			},
		})
		const roleCalls = saveRoleCalls()
		expect(roleCalls).toHaveLength(1)
		expect(roleCalls[0][1]).toEqual({
			user: 'jane@doe.com',
			role: 'Moderator',
			value: 1,
		})
		expect(w.emitted('created')?.[0]?.[0]).toEqual({ name: 'jane@doe.com' })
		expect(closeMock).toHaveBeenCalled()
	})

	it('assigns multiple selected roles with value 1', async () => {
		const w = mountModal()
		await open(w)
		callMock.mockResolvedValueOnce({ name: 'x@y.com' })
		await w.get('[data-testid="field-Email"]').setValue('x@y.com')
		await w.get('[data-testid="role-Moderator"]').trigger('click')
		await w.get('[data-testid="role-Student"]').trigger('click')
		await clickAction(w, 'Add')
		const roles = saveRoleCalls().map((c) => c[1].role)
		expect(roles).toContain('Moderator')
		expect(roles).toContain('LMS Student')
		expect(saveRoleCalls().every((c) => c[1].value === 1)).toBe(true)
	})

	it('pre-applies defaultRoles when opened', async () => {
		const w = mountModal({ defaultRoles: ['lms_student'] })
		await open(w)
		expect(
			w.get('[data-testid="role-Student"]').attributes('data-checked')
		).toBe('true')
		expect(
			w.get('[data-testid="role-Moderator"]').attributes('data-checked')
		).toBe('false')
	})

	it('toasts on insert failure without closing', async () => {
		const w = mountModal()
		await open(w)
		callMock.mockRejectedValueOnce({ messages: ['boom'] })
		await w.get('[data-testid="field-Email"]').setValue('a@b.com')
		await clickAction(w, 'Add')
		expect(toastMock.error).toHaveBeenCalledWith('boom')
		expect(closeMock).not.toHaveBeenCalled()
	})
})

const editMember = (roles: string[] = []) => ({
	name: 'mod@x.com',
	full_name: 'Mod X',
	roles,
})

describe('NewMemberModal — edit mode', () => {
	it('shows edit title/action, hides name fields, disables prefilled email', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		expect(w.get('[data-testid="title"]').text()).toBe('Edit Member')
		expect(w.find('[data-testid="action-Save"]').exists()).toBe(true)
		expect(w.find('[data-testid="field-First Name"]').exists()).toBe(false)
		const email = w.get('[data-testid="field-Email"]')
		expect(email.attributes('disabled')).toBeDefined()
		expect((email.element as HTMLInputElement).value).toBe('mod@x.com')
	})

	it('reflects the member current roles in the switches', async () => {
		const w = mountModal({
			editMember: editMember(['Moderator', 'Batch Evaluator']),
		})
		await open(w)
		expect(
			w.get('[data-testid="role-Moderator"]').attributes('data-checked')
		).toBe('true')
		expect(
			w.get('[data-testid="role-Evaluator"]').attributes('data-checked')
		).toBe('true')
		expect(
			w.get('[data-testid="role-Course Creator"]').attributes('data-checked')
		).toBe('false')
	})

	it('no-op save makes ZERO save_role calls but still emits updated + closes', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		await clickAction(w, 'Save')
		expect(saveRoleCalls()).toHaveLength(0)
		expect(w.emitted('updated')).toBeTruthy()
		expect(closeMock).toHaveBeenCalled()
	})

	it('adding a role calls save_role(role, 1) exactly once', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		await w.get('[data-testid="role-Course Creator"]').trigger('click')
		await clickAction(w, 'Save')
		expect(saveRoleCalls()).toHaveLength(1)
		expect(saveRoleCalls()[0][1]).toEqual({
			user: 'mod@x.com',
			role: 'Course Creator',
			value: 1,
		})
	})

	it('removing an existing role calls save_role(role, 0)', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		await w.get('[data-testid="role-Moderator"]').trigger('click')
		await clickAction(w, 'Save')
		expect(saveRoleCalls()).toHaveLength(1)
		expect(saveRoleCalls()[0][1]).toEqual({
			user: 'mod@x.com',
			role: 'Moderator',
			value: 0,
		})
	})

	it('toggling a role on then off (back to initial) makes no call for it', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		const ev = w.get('[data-testid="role-Evaluator"]')
		await ev.trigger('click') // on
		await ev.trigger('click') // off again -> back to initial (false)
		await clickAction(w, 'Save')
		expect(saveRoleCalls()).toHaveLength(0)
	})

	it('applies multiple diffs with correct values', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		await w.get('[data-testid="role-Moderator"]').trigger('click') // remove
		await w.get('[data-testid="role-Course Creator"]').trigger('click') // add
		await clickAction(w, 'Save')
		const byRole = Object.fromEntries(
			saveRoleCalls().map((c) => [c[1].role, c[1].value])
		)
		expect(byRole).toEqual({ Moderator: 0, 'Course Creator': 1 })
	})

	it('reloads roles when reopened for a different member', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		await w.setProps({ modelValue: false })
		await w.setProps({ editMember: editMember(['Batch Evaluator']) })
		await open(w)
		expect(
			w.get('[data-testid="role-Moderator"]').attributes('data-checked')
		).toBe('false')
		expect(
			w.get('[data-testid="role-Evaluator"]').attributes('data-checked')
		).toBe('true')
	})

	it('toasts on save_role failure without closing', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		callMock.mockRejectedValueOnce({ messages: ['nope'] })
		await w.get('[data-testid="role-Course Creator"]').trigger('click')
		await clickAction(w, 'Save')
		expect(toastMock.error).toHaveBeenCalledWith('nope')
		expect(closeMock).not.toHaveBeenCalled()
	})

	it('treats LMS Student like any other role in the diff', async () => {
		const w = mountModal({
			editMember: editMember(['LMS Student', 'Moderator']),
		})
		await open(w)
		expect(
			w.get('[data-testid="role-Student"]').attributes('data-checked')
		).toBe('true')
		await w.get('[data-testid="role-Student"]').trigger('click') // remove
		await clickAction(w, 'Save')
		expect(saveRoleCalls()).toHaveLength(1)
		expect(saveRoleCalls()[0][1]).toEqual({
			user: 'mod@x.com',
			role: 'LMS Student',
			value: 0,
		})
	})
})

describe('NewMemberModal — adversarial / state isolation', () => {
	it('switching from edit back to add resets to a blank add form', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		expect(w.get('[data-testid="title"]').text()).toBe('Edit Member')

		await w.setProps({ modelValue: false })
		await w.setProps({ editMember: null })
		await open(w)

		expect(w.get('[data-testid="title"]').text()).toBe('Add New Member')
		expect(w.find('[data-testid="field-First Name"]').exists()).toBe(true)
		expect(
			w.get('[data-testid="role-Moderator"]').attributes('data-checked')
		).toBe('false')
		const email = w.get('[data-testid="field-Email"]')
		expect((email.element as HTMLInputElement).value).toBe('')
		expect(email.attributes('disabled')).toBeUndefined()
	})

	it('blocks a whitespace-only email in add mode', async () => {
		const w = mountModal()
		await open(w)
		await w.get('[data-testid="field-Email"]').setValue('   ')
		await clickAction(w, 'Add')
		expect(toastMock.error).toHaveBeenCalledWith('Email is required')
		expect(callMock).not.toHaveBeenCalled()
	})

	it('does not double-submit role changes when Save is clicked twice', async () => {
		const w = mountModal({ editMember: editMember(['Moderator']) })
		await open(w)
		await w.get('[data-testid="role-Course Creator"]').trigger('click')
		// fire both clicks synchronously so the 2nd lands while the 1st is
		// still in-flight (submitting === true)
		const btn = w.get('[data-testid="action-Save"]')
		btn.trigger('click')
		btn.trigger('click')
		await flushPromises()
		expect(saveRoleCalls()).toHaveLength(1)
	})
})
