import { defineComponent, nextTick } from 'vue'
import { mount, VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createResource, resources } = vi.hoisted(() => ({
	createResource: vi.fn(),
	resources: [] as Array<{ transform: (data: Record<string, string>) => void }>,
}))

vi.mock('frappe-ui', () => ({ createResource }))

const Label = defineComponent({
	template: '<span data-label>{{ __(\'Courses\') }}</span>',
})

async function mountTranslatedLabel() {
	const { default: translationPlugin } = await import('@/translation')
	return mount(Label, { global: { plugins: [translationPlugin] } })
}

function label(wrapper: VueWrapper) {
	return wrapper.get('[data-label]').text()
}

beforeEach(() => {
	resources.length = 0
	createResource.mockReset().mockImplementation((options) => {
		resources.push(options)
		return {}
	})
	delete window.translatedMessages
	delete window.__
	vi.resetModules()
})

describe('translation startup', () => {
	it('renders immediately and updates a persistent label after a late response', async () => {
		const wrapper = await mountTranslatedLabel()

		expect(label(wrapper)).toBe('Courses')
		expect(createResource).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'lms.lms.api.get_translations',
				cache: 'translations',
				auto: true,
			})
		)

		resources[0].transform({ Courses: 'Cursos' })
		await nextTick()

		expect(label(wrapper)).toBe('Cursos')
	})

	it('uses a cached dictionary without waiting for the network refresh', async () => {
		createResource.mockImplementation((options) => {
			resources.push(options)
			options.transform({ Courses: 'Cursos guardados' })
			return {}
		})

		const wrapper = await mountTranslatedLabel()

		expect(label(wrapper)).toBe('Cursos guardados')
	})

	it('keeps rendering source labels when the translation request fails', async () => {
		createResource.mockImplementation((options) => {
			resources.push(options)
			return { error: new Error('network unavailable') }
		})

		const wrapper = await mountTranslatedLabel()

		expect(label(wrapper)).toBe('Courses')
		expect(wrapper.html()).not.toBe('')
	})

	it('shares reactive translations with EditorJS sub-apps regardless of mount order', async () => {
		const editorApp = await mountTranslatedLabel()
		const mainApp = await mountTranslatedLabel()

		expect(label(editorApp)).toBe('Courses')
		expect(label(mainApp)).toBe('Courses')

		resources[0].transform({ Courses: 'Cursos' })
		await nextTick()

		expect(label(editorApp)).toBe('Cursos')
		expect(label(mainApp)).toBe('Cursos')
	})
})
