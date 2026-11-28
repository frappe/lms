import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { callMock, uploadMock, toastMock } = vi.hoisted(() => ({
	callMock: vi.fn(),
	uploadMock: vi.fn(),
	toastMock: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: toastMock,
	FileUploadHandler: class {
		upload(...args: unknown[]) {
			return uploadMock(...args)
		}
	},
	Dialog: {
		props: ['open'],
		template:
			'<div v-if="open" role="dialog"><slot /><slot name="actions" /></div>',
	},
	Button: {
		props: ['disabled', 'label'],
		template:
			'<button :disabled="disabled" :aria-label="label"><slot name="icon" /><slot /></button>',
	},
}))
vi.mock('@/utils/', () => ({ getFileSize: (size: number) => `${size}B` }))

import ScormUploadDialog from '@/components/Modals/ScormUploadDialog.vue'

vi.stubGlobal('__', (text: string) => text)
if (!String.prototype.format) {
	String.prototype.format = function (this: string, ...args: string[]) {
		return this.replace(/{(\d+)}/g, (_, i: string) => args[Number(i)] ?? '')
	}
}

const zip = (name: string, size = 10) =>
	new File(['x'.repeat(size)], name, { type: 'application/zip' })

let wrapper: VueWrapper

function mountDialog() {
	wrapper = mount(ScormUploadDialog, {
		props: { open: true, courseName: 'C1' },
		global: { mocks: { __: (text: string) => text } },
	})
	return wrapper
}

async function pick(...files: File[]) {
	const input = wrapper.find('input[type="file"]')
	Object.defineProperty(input.element, 'files', {
		value: files,
		configurable: true,
	})
	await input.trigger('change')
}

const rows = () => wrapper.findAll('[data-testid="scorm-package"]')
const submit = () => wrapper.find('[data-testid="scorm-submit"]')

beforeEach(() => {
	vi.clearAllMocks()
	uploadMock.mockImplementation((file: File) =>
		Promise.resolve({ name: `FILE-${file.name}`, file_url: `/${file.name}` })
	)
	callMock.mockResolvedValue({})
})
afterEach(() => wrapper?.unmount())

describe('ScormUploadDialog', () => {
	it('lists picked packages with a title from the file name', async () => {
		mountDialog()
		await pick(
			zip('lms-dashboard-design-brief.zip', 21),
			zip('safety_induction.zip')
		)

		expect(rows()).toHaveLength(2)
		expect(rows()[0].text()).toContain('Lms dashboard design brief')
		expect(rows()[0].text()).toContain('lms-dashboard-design-brief.zip · 21B')
		expect(rows()[1].text()).toContain('Safety induction')
		expect(submit().text()).toBe('Add 2 chapters')
	})

	it('rejects files that are not ZIPs', async () => {
		mountDialog()
		await pick(zip('notes.pdf'))

		expect(rows()).toHaveLength(0)
		expect(toastMock.error).toHaveBeenCalled()
		expect(submit().attributes('disabled')).toBeDefined()
	})

	it('removes a package from the list', async () => {
		mountDialog()
		await pick(zip('one.zip'), zip('two.zip'))
		await rows()[0].find('button').trigger('click')

		expect(rows()).toHaveLength(1)
		expect(rows()[0].text()).toContain('Two')
		expect(submit().text()).toBe('Add chapter')
	})

	it('adds one SCORM chapter per package, in order', async () => {
		mountDialog()
		await pick(zip('one.zip'), zip('two.zip'))
		await submit().trigger('click')
		await flushPromises()

		expect(uploadMock).toHaveBeenCalledTimes(2)
		expect(callMock.mock.calls).toEqual([
			[
				'lms.lms.api.upsert_chapter',
				{
					title: 'One',
					course: 'C1',
					is_scorm_package: 1,
					scorm_package: { name: 'FILE-one.zip', file_url: '/one.zip' },
				},
			],
			[
				'lms.lms.api.upsert_chapter',
				expect.objectContaining({ title: 'Two', course: 'C1' }),
			],
		])
		expect(wrapper.emitted('added')).toHaveLength(1)
		expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
	})

	it('keeps going past a failed package and keeps it listed', async () => {
		callMock
			.mockRejectedValueOnce({ messages: ['Invalid package'] })
			.mockResolvedValueOnce({})
		mountDialog()
		await pick(zip('broken.zip'), zip('good.zip'))
		await submit().trigger('click')
		await flushPromises()

		expect(callMock).toHaveBeenCalledTimes(2)
		expect(toastMock.error).toHaveBeenCalledWith('broken.zip: Invalid package')
		expect(wrapper.emitted('added')).toHaveLength(1)
		expect(wrapper.emitted('update:open')).toBeUndefined()
		expect(rows()).toHaveLength(1)
		expect(rows()[0].text()).toContain('Broken')
	})
})
