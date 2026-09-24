// rc.1 <Editor> is renderless, so a `space-y-*` wrapper would split the
// toolbar from the content box. Label spacing must live on the label.
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DiscussionModal from '@/components/Modals/DiscussionModal.vue'

vi.mock('frappe-ui', () => ({
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: { template: '<div><slot /></div>' },
	FormControl: { template: '<input />' },
}))
vi.mock('frappe-ui/experimental', () => ({
	InputLabel: {
		props: ['id', 'label'],
		template: '<label data-testid="details-label">{{ label }}</label>',
	},
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { template: '<div data-testid="editor" />' },
}))
vi.mock('@/utils', () => ({ singularize: (s: string) => s }))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.stubGlobal('__', (s: string) => s)

const mountModal = () =>
	mount(DiscussionModal, {
		props: {
			modelValue: true,
			title: 'Questions',
			doctype: 'Course Lesson',
			docname: 'L1',
		},
		global: { mocks: { __: (s: string) => s } },
	})

describe('DiscussionModal details editor', () => {
	it('keeps the editor wrapper free of sibling spacing', () => {
		const wrapper = mountModal()
		const editorParent = wrapper.get('[data-testid="editor"]').element
			.parentElement as HTMLElement
		expect(editorParent.className).not.toMatch(/\bspace-y-/)
	})

	it('spaces the label with its own margin', () => {
		const wrapper = mountModal()
		expect(wrapper.get('[data-testid="details-label"]').classes()).toContain(
			'mb-1.5'
		)
	})
})
