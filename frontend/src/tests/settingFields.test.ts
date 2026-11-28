import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { call, upload } = vi.hoisted(() => ({
	call: vi.fn(),
	upload: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	call,
	toast: { error: vi.fn() },
	FileUploadHandler: class {
		upload = upload
	},
	Button: {
		name: 'Button',
		props: ['theme', 'variant', 'loading', 'tooltip'],
		emits: ['click'],
		template: '<button @click="$emit(\'click\')"><slot /></button>',
	},
	FormControl: {
		name: 'FormControl',
		props: ['modelValue', 'type', 'variant'],
		template: '<input />',
	},
	Switch: {
		name: 'Switch',
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template:
			'<button role="switch" @click="$emit(\'update:modelValue\', !modelValue)" />',
	},
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		name: 'Link',
		props: ['modelValue', 'filters', 'variant'],
		emits: ['update:modelValue'],
		template: '<div />',
	},
}))
vi.mock('@/components/InlineEdit/PickerDialog.vue', () => ({
	default: {
		name: 'PickerDialog',
		props: ['open', 'items', 'categories'],
		emits: ['add', 'update:open'],
		template: '<div />',
	},
}))
vi.mock('@/composables/useCoursePickerItems', async () => {
	const { ref } = await import('vue')
	return {
		useCoursePickerItems: () => ({
			items: ref([]),
			categories: ref([]),
			load: vi.fn(),
		}),
	}
})
vi.mock('@/components/CourseCard.vue', () => ({
	default: { name: 'CourseCard', props: ['course'], template: '<article />' },
}))

import SettingAction from '@/components/InlineEdit/SettingAction.vue'
import SettingField from '@/components/InlineEdit/SettingField.vue'
import SettingImage from '@/components/InlineEdit/SettingImage.vue'
import SettingSwitch from '@/components/InlineEdit/SettingSwitch.vue'
import SearchPreview from '@/components/InlineEdit/SearchPreview.vue'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'
import SettingsPage from '@/components/InlineEdit/SettingsPage.vue'
import SettingsGroup from '@/components/InlineEdit/SettingsGroup.vue'
import RelatedCoursesEditor from '@/components/Courses/RelatedCoursesEditor.vue'

// frappe's translation layer patches String.prototype.format in at runtime.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

const global = { mocks: { __: (text: string) => text } }

describe('the shared settings fields', () => {
	it('keeps a 0/1 field a number when switched', async () => {
		const wrapper = mount(SettingSwitch, {
			props: { label: 'Featured', modelValue: 0 },
			global,
		})
		await wrapper.get('[role="switch"]').trigger('click')
		expect(wrapper.emitted('update:modelValue')).toEqual([[1]])
	})

	it('puts a short input on the end and a textarea under the label', () => {
		const short = mount(SettingField, { props: { label: 'Keywords' }, global })
		const long = mount(SettingField, {
			props: { label: 'Description', type: 'textarea' },
			global,
		})
		const input = short.getComponent({ name: 'FormControl' })
		expect(input.props('variant')).toBe('outline')
		expect(input.element.closest('.shrink-0')).not.toBeNull()
		// frappe-ui's controls fill their parent, so the width sits on a wrapper,
		// capped so a phone-width row never pushes it past the screen.
		expect(input.element.parentElement?.className).toBe('w-60 max-w-full')
		const textarea = long.getComponent({ name: 'FormControl' })
		expect(textarea.props('type')).toBe('textarea')
		expect(textarea.element.closest('.shrink-0')).toBeNull()
	})

	// On a phone the label keeps its width and the control drops below it.
	it('lets the control wrap under the label instead of squeezing it', () => {
		const wrapper = mount(SettingField, {
			props: { label: 'Keywords' },
			global,
		})
		const row = wrapper.get(':scope > div')
		expect(row.classes()).toContain('flex-wrap')
		expect(row.get(':scope > div').classes()).toEqual(
			expect.arrayContaining(['grow', 'basis-48'])
		)
	})

	it('draws a danger action red and reports the click', async () => {
		const wrapper = mount(SettingAction, {
			props: { label: 'Delete course', action: 'Delete', danger: true },
			global,
		})
		const button = wrapper.getComponent({ name: 'Button' })
		expect(button.props('theme')).toBe('red')
		await button.trigger('click')
		expect(wrapper.emitted('click')).toHaveLength(1)
	})
})

describe('the settings image', () => {
	const mountImage = (modelValue: string | null) =>
		mount(SettingImage, {
			props: { label: 'Meta image', modelValue },
			global,
		})
	const png = new File(['png'], 'share.png', { type: 'image/png' })

	it('sits under the label as a dropzone that uploads a dropped image public', async () => {
		upload.mockResolvedValueOnce({ file_url: '/files/share.png' })
		const wrapper = mountImage(null)
		const zone = wrapper.get('[data-testid="setting-image-drop"]')
		expect(zone.element.closest('.shrink-0')).toBeNull()
		expect(zone.classes()).toContain('border-dashed')
		expect(zone.text()).toContain('Drop an image here, or')
		expect(wrapper.find('[data-testid="setting-image-remove"]').exists()).toBe(
			false
		)
		const drop = new Event('drop', { bubbles: true, cancelable: true })
		Object.defineProperty(drop, 'dataTransfer', {
			value: { files: [png], items: [{ kind: 'file', type: 'image/png' }] },
		})
		await zone.trigger('dragenter')
		expect(zone.classes()).toContain('bg-surface-gray-2')
		zone.element.dispatchEvent(drop)
		await flushPromises()
		expect(zone.classes()).not.toContain('bg-surface-gray-2')
		expect(upload).toHaveBeenCalledWith(png, { private: false })
		expect(wrapper.emitted('update:modelValue')).toEqual([['/files/share.png']])
	})

	it('opens the file picker from the browse link', async () => {
		const wrapper = mountImage('/files/share.png')
		expect(wrapper.text()).toContain('Drop a new image to replace, or')
		const input = wrapper.get('input[type="file"]')
		const click = vi.spyOn(input.element as HTMLInputElement, 'click')
		const browse = wrapper.get('[data-testid="setting-image-browse"]')
		expect(browse.element.tagName).toBe('BUTTON')
		await browse.trigger('click')
		expect(click).toHaveBeenCalled()
	})

	it('clears the image from the cross', async () => {
		const wrapper = mountImage('/files/share.png')
		const remove = wrapper.getComponent({ name: 'Button' })
		expect(remove.props('tooltip')).toBe('Remove image')
		expect(remove.attributes('aria-label')).toBe('Remove image')
		await remove.trigger('click')
		expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
	})
})

describe('the search preview', () => {
	it('shows the address, title and description as a result would', () => {
		const wrapper = mount(SearchPreview, {
			props: {
				url: 'school.example/lms/courses/erpnext',
				title: 'ERPNext Essentials',
				description: 'Become a certified consultant.',
			},
			global,
		})
		expect(wrapper.text()).toContain('school.example/lms/courses/erpnext')
		expect(wrapper.text()).toContain('ERPNext Essentials')
		expect(wrapper.text()).toContain('Become a certified consultant.')
		expect(wrapper.classes()).toEqual(
			expect.arrayContaining(['rounded-6', 'border', 'border-outline-gray-2'])
		)
	})

	it('sits in a labelled settings row with no control', () => {
		const wrapper = mount(
			{
				components: { SettingRow, SearchPreview },
				template: `<SettingRow label="Meta preview"><SearchPreview url="x" /></SettingRow>`,
			},
			{ global }
		)
		expect(wrapper.text()).toContain('Meta preview')
		expect(wrapper.find('.shrink-0').exists()).toBe(false)
		expect(wrapper.find('[data-testid="search-preview"]').exists()).toBe(true)
	})

	it('shows the shared image as a thumbnail only when there is one', () => {
		const withImage = mount(SearchPreview, {
			props: { url: 'x', image: '/files/cover.png' },
			global,
		})
		expect(withImage.get('img').attributes('src')).toBe('/files/cover.png')
		const without = mount(SearchPreview, { props: { url: 'x' }, global })
		expect(without.find('img').exists()).toBe(false)
	})

	it('asks for a description while there is none', () => {
		const wrapper = mount(SearchPreview, { props: { url: 'x' }, global })
		expect(wrapper.text()).toContain('Add a description to show here.')
	})
})

describe('the settings page section nav', () => {
	const mountPage = (showLast = true, openSection?: string) =>
		mount(
			{
				components: { SettingsPage, SettingsGroup },
				props: ['showLast', 'openSection'],
				template: `
					<SettingsPage :openSection="openSection">
						<SettingsGroup title="Access" icon="lucide-door-open" />
						<SettingsGroup title="Thumbnail" icon="lucide-image" name="thumbnail" />
						<SettingsGroup v-if="showLast" title="Manage" />
					</SettingsPage>`,
			},
			{ props: { showLast, openSection }, global, attachTo: document.body }
		)

	it('lists every section in page order with its icon, the first marked', async () => {
		const wrapper = mountPage()
		await flushPromises()
		const items = wrapper.findAll('nav button')
		expect(wrapper.find('nav').text()).toContain('3 sections')
		expect(items.map((item) => item.text())).toEqual([
			'Access',
			'Thumbnail',
			'Manage',
		])
		expect(items[0].find('.lucide-door-open').exists()).toBe(true)
		expect(items[0].attributes('aria-current')).toBe('location')
		wrapper.unmount()
	})

	it('scrolls to a picked section and marks it', async () => {
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView
		const wrapper = mountPage()
		await flushPromises()
		await wrapper.findAll('nav button')[1].trigger('click')
		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: 'smooth',
			block: 'start',
		})
		expect(wrapper.findAll('nav button')[1].attributes('aria-current')).toBe(
			'location'
		)
		wrapper.unmount()
	})

	it('keeps a picked section marked until its scroll ends', async () => {
		Element.prototype.scrollIntoView = vi.fn()
		let report: (entries: Partial<IntersectionObserverEntry>[]) => void
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(callback: typeof report) {
					report = callback
				}
				observe() {}
				unobserve() {}
				disconnect() {}
			}
		)
		const wrapper = mountPage()
		await flushPromises()
		const items = () => wrapper.findAll('nav button')
		const thumbnail = document.getElementById('settings-thumbnail')!
		await items()[2].trigger('click')
		// The page bottoms out with Thumbnail still in the top band.
		report!([{ target: thumbnail, isIntersecting: true }])
		await flushPromises()
		expect(items()[2].attributes('aria-current')).toBe('location')

		window.dispatchEvent(new Event('scrollend'))
		report!([{ target: thumbnail, isIntersecting: true }])
		await flushPromises()
		expect(items()[1].attributes('aria-current')).toBe('location')
		wrapper.unmount()
		vi.unstubAllGlobals()
	})

	it('hides the section panel while Flow is docked beside the app', async () => {
		const wrapper = mountPage()
		await flushPromises()
		// Flow sets its dock width first; the margin it drives animates in later.
		const panel = () => wrapper.get('[data-testid="settings-sections"]')
		document.documentElement.style.setProperty('--flow-dock-width', '420px')
		await flushPromises()
		// It fades out and goes inert, so it can animate instead of vanishing.
		expect(panel().attributes('inert')).toBeDefined()
		expect(panel().classes()).toContain('opacity-0')
		document.documentElement.style.removeProperty('--flow-dock-width')
		await flushPromises()
		expect(panel().attributes('inert')).toBeUndefined()
		expect(panel().classes()).not.toContain('opacity-0')
		wrapper.unmount()
	})

	it('takes the first section to the very top of the page', async () => {
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView
		const scroller = document.createElement('main')
		scroller.style.overflowY = 'auto'
		scroller.scrollTo = vi.fn()
		document.body.appendChild(scroller)
		const wrapper = mountPage()
		const page = wrapper.element as HTMLElement
		scroller.appendChild(page)
		await flushPromises()
		await wrapper.findAll('nav button')[0].trigger('click')
		expect(scroller.scrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: 'smooth',
		})
		expect(scrollIntoView).not.toHaveBeenCalled()
		wrapper.unmount()
		scroller.remove()
	})

	it('opens on the section a link names', async () => {
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView
		const wrapper = mountPage(true, 'thumbnail')
		await flushPromises()
		expect(scrollIntoView).toHaveBeenCalledTimes(1)
		expect(wrapper.findAll('nav button')[1].attributes('aria-current')).toBe(
			'location'
		)
		wrapper.unmount()
	})

	it('drops a section that goes away', async () => {
		const wrapper = mountPage()
		await flushPromises()
		await wrapper.setProps({ showLast: false })
		expect(wrapper.findAll('nav button')).toHaveLength(2)
		wrapper.unmount()
	})
})

describe('the related courses editor', () => {
	const mountEditor = (modelValue: string[]) =>
		mount(RelatedCoursesEditor, {
			props: {
				courseName: 'course-a',
				modelValue,
				'onUpdate:modelValue': (value: string[]) =>
					wrapper.setProps({ modelValue: value }),
			},
			global,
		})
	let wrapper: ReturnType<typeof mountEditor>

	it('shows each related course as its card', async () => {
		call.mockImplementation((_method, { course }) =>
			Promise.resolve({ name: course, title: course.toUpperCase() })
		)
		wrapper = mountEditor(['course-b'])
		await flushPromises()
		expect(
			wrapper.getComponent({ name: 'CourseCard' }).props('course')
		).toEqual({ name: 'course-b', title: 'COURSE-B' })
	})

	it('adds the courses picked in the dialog once, and removes one', async () => {
		wrapper = mountEditor(['course-b'])
		const dialog = wrapper.getComponent({ name: 'PickerDialog' })
		expect(dialog.props('open')).toBe(false)
		await wrapper.get('[data-testid="add-related-course"]').trigger('click')
		expect(dialog.props('open')).toBe(true)

		dialog.vm.$emit('add', ['course-c', 'course-b'])
		await flushPromises()
		expect(wrapper.props('modelValue')).toEqual(['course-b', 'course-c'])

		await wrapper
			.findAll('[data-testid="related-course"] button')[0]
			.trigger('click')
		expect(wrapper.props('modelValue')).toEqual(['course-c'])
	})
})
