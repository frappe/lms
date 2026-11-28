import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import CourseTagsField from '@/components/Courses/CourseTagsField.vue'

// jsdom has no scrollIntoView; reka's Listbox calls it when the popover opens.
Element.prototype.scrollIntoView = () => {}

const mounted: { unmount: () => void }[] = []

afterEach(() => {
	mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function openPicker(tags: string) {
	const doc = reactive({ tags })
	const wrapper = mount(CourseTagsField, {
		attachTo: document.body,
		global: {
			mocks: { __: globalThis.__ },
			provide: { courseForm: { resource: { doc }, markDirty: () => {} } },
		},
	})
	mounted.push(wrapper)
	await wrapper.get('[aria-label="Add tag"]').trigger('click')
	await flushPromises()
	return doc
}

function button(label: string): HTMLButtonElement | undefined {
	return Array.from(document.querySelectorAll('button')).find(
		(element) => element.textContent?.trim() === label
	)
}

async function typeQuery(text: string) {
	const input = document.querySelector<HTMLInputElement>(
		'[data-slot="search"] input'
	)!
	input.value = text
	input.dispatchEvent(new Event('input'))
	await flushPromises()
}

describe('CourseTagsField footer', () => {
	it('shows no bulk actions when there is nothing to select', async () => {
		await openPicker('')
		expect(button('Select All')).toBeUndefined()
		expect(button('Clear All')).toBeUndefined()
		expect(document.querySelector('[data-slot="footer"]')?.textContent).toBe('')
	})

	it('offers Select All for a typed tag and creates it', async () => {
		const doc = await openPicker('')
		await typeQuery('sql')
		expect(document.body.textContent).toContain('Create "sql"')
		button('Select All')!.click()
		await flushPromises()
		expect(doc.tags).toBe('sql')
	})

	it('hides Select All once every tag is selected but keeps Clear All', async () => {
		await openPicker('sql, python')
		expect(button('Select All')).toBeUndefined()
		expect(button('Clear All')).toBeDefined()
		await typeQuery('python')
		expect(button('Select All')).toBeUndefined()
	})
})
