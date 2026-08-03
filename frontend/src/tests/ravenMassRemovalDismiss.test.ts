/**
 * MassRemovalConfirmDialog: every way out of the dialog has to settle the caller.
 * Escape / overlay close it through the Dialog's v-model, never through an action,
 * so without a close-driven cancel the panel keeps an edit it never applied.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MassRemovalConfirmDialog from '@/components/Settings/Raven/MassRemovalConfirmDialog.vue'

vi.mock('frappe-ui', () => ({
	Dialog: {
		props: ['modelValue', 'title', 'message', 'size', 'actions'],
		emits: ['update:modelValue'],
		template: `
			<div>
				<button
					data-testid="dismiss"
					@click="$emit('update:modelValue', false)"
				/>
				<button
					v-for="a in actions"
					:key="a.label"
					:data-testid="'action-' + (a.variant ?? 'plain')"
					@click="a.onClick()"
				>{{ a.label }}</button>
			</div>
		`,
	},
}))

vi.stubGlobal('__', (s: string) => s)
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_m: string, i: number) => String(args[i]))
}

const dialog = () =>
	mount(MassRemovalConfirmDialog, {
		props: { open: true, removedCount: 31, targetLabel: 'Design HQ' },
		global: { config: { globalProperties: { __: (s: string) => s } } },
	})

describe('MassRemovalConfirmDialog: dismissal settles the caller', () => {
	it('emits cancel when the dialog is dismissed without an action', async () => {
		const wrapper = dialog()

		await wrapper.get('[data-testid="dismiss"]').trigger('click')

		expect(wrapper.emitted('cancel')).toHaveLength(1)
		expect(wrapper.emitted('confirm')).toBeUndefined()
	})

	it('emits cancel once when the Cancel action closes the dialog', async () => {
		const wrapper = dialog()

		await wrapper.get('[data-testid="action-plain"]').trigger('click')

		expect(wrapper.emitted('cancel')).toHaveLength(1)
		expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
	})

	it('does not turn a confirmation into a cancel when it closes', async () => {
		const wrapper = dialog()

		await wrapper.get('[data-testid="action-solid"]').trigger('click')

		expect(wrapper.emitted('confirm')).toHaveLength(1)
		expect(wrapper.emitted('cancel')).toBeUndefined()
	})

	it('cancels again after the dialog is reopened', async () => {
		const wrapper = dialog()
		await wrapper.get('[data-testid="dismiss"]').trigger('click')

		// The caller's v-model writes the close back before it reopens the dialog.
		await wrapper.setProps({ open: false })
		await wrapper.setProps({ open: true })
		await wrapper.get('[data-testid="dismiss"]').trigger('click')

		expect(wrapper.emitted('cancel')).toHaveLength(2)
	})
})
