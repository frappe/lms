import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Badge: { template: '<span data-testid="unsaved"><slot /></span>' },
	Button: { template: '<button><slot /></button>' },
	Tooltip: { template: '<span><slot /></span>' },
}))
vi.mock('@/components/ShortcutTooltip.vue', () => ({
	default: { template: '<span><slot /></span>' },
}))

import CourseSaveButton from '@/components/Courses/CourseSaveButton.vue'
import BatchSaveButton from '@/pages/Batches/components/BatchSaveButton.vue'

const global = { mocks: { __: (text: string) => text } }

const courseForm = (isDirty: boolean, draft = false) => ({
	isDirty: ref(isDirty),
	missingFields: ref([]),
	showRequired: ref(false),
	resource: { setValue: { loading: false } },
	submitCourse: vi.fn(),
	...(draft ? { draftChapters: ref([]) } : {}),
})

const batchForm = (isDirty: boolean, draft = false) => ({
	isDirty: ref(isDirty),
	missingFields: ref([]),
	isSaving: ref(false),
	saveTooltip: ref(''),
	previewRequired: vi.fn(),
	submitBatch: vi.fn(),
	...(draft ? { draft: {} } : {}),
})

const unsaved = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="unsaved"]').exists()

describe('Not saved beside Save', () => {
	it.each([
		['course', CourseSaveButton, courseForm],
		['batch', BatchSaveButton, batchForm],
	] as const)('shows on a %s with unsaved changes only', (_, Save, form) => {
		const mountWith = (props: object) =>
			mount(Save as never, { props: { form: props }, global })
		expect(unsaved(mountWith(form(true)))).toBe(true)
		expect(unsaved(mountWith(form(false)))).toBe(false)
		expect(unsaved(mountWith(form(true, true)))).toBe(false)
	})
})
