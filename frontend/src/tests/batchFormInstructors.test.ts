import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { stub } = vi.hoisted(() => ({
	stub: { inheritAttrs: false, render: () => null },
}))

vi.mock('frappe-ui', () => ({
	createDocumentResource: () => ({
		doc: { name: 'B1', title: 'Batch', instructors: [] },
		setValue: { submit: vi.fn() },
		reload: vi.fn(),
	}),
	createResource: () => ({ data: null, reload: vi.fn(), submit: vi.fn() }),
	toast: { success: vi.fn(), error: vi.fn() },
	call: vi.fn(),
	Combobox: stub,
	FormControl: stub,
}))
vi.mock('frappe-ui/experimental', () => ({
	InputLabel: stub,
	useInputLabeling: () => ({ inputId: 'id', labelId: 'label' }),
}))

// Only the instructors picker is under test; it reports what it was given.
vi.mock('@/components/Controls/MultiLink.vue', () => ({
	default: defineComponent({
		props: ['label', 'disabled'],
		render() {
			return h('div', {
				'data-testid': `multilink-${this.label}`,
				'data-disabled': String(Boolean(this.disabled)),
			})
		},
	}),
}))
for (const path of [
	'@/components/Controls/BooleanSwitch.vue',
	'@/components/Controls/Uploader.vue',
	'@/components/Controls/VideoPreviewField.vue',
	'@/components/Controls/Link.vue',
	'@/components/Controls/Select.vue',
	'@/components/RichTextEditor.vue',
	'@/components/Modals/NewMemberModal.vue',
	'@/pages/Batches/components/BatchCourses.vue',
	'@/pages/Batches/components/Assessments.vue',
]) {
	vi.doMock(path, () => ({ default: stub }))
}
vi.mock('@/utils', () => ({
	createLMSCategory: vi.fn(),
	getMetaInfo: vi.fn(),
	openSettings: vi.fn(),
	updateMetaInfo: vi.fn(),
}))
vi.mock('@/utils/batchForm', () => ({ validateBatch: vi.fn() }))
vi.mock('@/utils/format', () => ({ getDateFormat: () => 'YYYY-MM-DD' }))
vi.mock('@/utils/resource', () => ({ reportAutosaveError: vi.fn() }))
vi.mock('@/composables/useKeyboardShortcuts', () => ({
	useKeyboardShortcuts: vi.fn(),
	saveShortcut: vi.fn(),
}))
vi.mock('@/composables/useBatchForms', () => ({ openBatchForm: vi.fn() }))

const mountForm = async (batchData: Record<string, unknown>) => {
	const { default: BatchForm } = await import('@/pages/Batches/BatchForm.vue')
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/', component: { render: () => null } }],
	})
	const wrapper = mount(BatchForm, {
		props: { batch: { data: { name: 'B1', ...batchData } } },
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'ash@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper.find('[data-testid="multilink-Instructors"]')
}

describe('the batch form instructors picker', () => {
	it('is read-only for an evaluator who is not an instructor', async () => {
		const picker = await mountForm({ can_manage: true })
		expect(picker.attributes('data-disabled')).toBe('true')
	})

	it('is editable for an instructor or Moderator', async () => {
		const picker = await mountForm({
			can_manage: true,
			can_change_instructors: true,
		})
		expect(picker.attributes('data-disabled')).toBe('false')
	})
})
