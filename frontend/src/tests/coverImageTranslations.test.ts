import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EditCoverImage from '@/components/Modals/EditCoverImage.vue'
import translationPlugin from '@/translation'

vi.mock('frappe-ui', () => ({
	Popover: { template: '<div><slot /></div>' },
	TextInput: { template: '<input />' },
	Button: { template: '<button><slot /></button>' },
	FileUploader: {
		name: 'FileUploader',
		props: ['validateFile'],
		data: () => ({ uploading: false, progress: 0 }),
		template:
			'<div><slot :uploading="uploading" :progress="progress" :openFileSelector="() => {}" /></div>',
	},
	createResource: () => ({ data: null, loading: false, reload: vi.fn() }),
}))

const messages = {
	'search by keyword': 'buscar por palavra-chave',
	'Upload Image': 'Enviar imagem',
	'Uploading {0}%': 'Enviando {0}%',
	'Only image file is allowed.': 'Somente arquivos de imagem são permitidos.',
}

let wrapper: ReturnType<typeof mount>
const browser = window as Window & {
	translatedMessages?: Record<string, string>
	__?: (message: string) => unknown
}
let previousMessages: typeof browser.translatedMessages
let previousTranslate: typeof browser.__

beforeEach(() => {
	previousMessages = browser.translatedMessages
	previousTranslate = browser.__
	browser.translatedMessages = messages
	wrapper = mount(EditCoverImage, { global: { plugins: [translationPlugin] } })
})

afterEach(() => {
	wrapper.unmount()
	browser.translatedMessages = previousMessages
	browser.__ = previousTranslate
})

describe('cover-image translations', () => {
	it('translates the search placeholder and upload action', () => {
		expect(wrapper.get('input').attributes('placeholder')).toBe(
			messages['search by keyword']
		)
		expect(wrapper.get('button').text()).toBe(messages['Upload Image'])
	})

	it.each([0, 37, 100])(
		'preserves upload progress %s in the translation',
		async (progress) => {
			await wrapper.getComponent({ name: 'FileUploader' }).setData({
				uploading: true,
				progress,
			})
			expect(wrapper.get('button').text()).toBe(`Enviando ${progress}%`)
		}
	)

	it('translates validation feedback while preserving allowed image extensions', () => {
		const validate = wrapper
			.getComponent({ name: 'FileUploader' })
			.props('validateFile')
		expect(validate({ name: 'notes.txt' })).toBe(
			messages['Only image file is allowed.']
		)
		for (const extension of ['jpg', 'jpeg', 'png', 'JPG']) {
			expect(validate({ name: `cover.${extension}` })).toBeUndefined()
		}
	})

	it('keeps English fallback text when translations are unavailable', async () => {
		wrapper.unmount()
		browser.translatedMessages = {}
		wrapper = mount(EditCoverImage, {
			global: { plugins: [translationPlugin] },
		})
		expect(wrapper.get('input').attributes('placeholder')).toBe(
			'search by keyword'
		)
		expect(wrapper.get('button').text()).toBe('Upload Image')
		await wrapper
			.getComponent({ name: 'FileUploader' })
			.setData({ uploading: true, progress: 37 })
		expect(wrapper.get('button').text()).toBe('Uploading 37%')
	})
})
