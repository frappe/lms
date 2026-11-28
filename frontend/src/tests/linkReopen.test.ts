import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Link from '@/components/Controls/Link.vue'

const { searches } = vi.hoisted(() => ({ searches: [] as string[] }))

vi.mock('frappe-ui', async (importOriginal) => {
	const actual = await importOriginal<typeof import('frappe-ui')>()
	return {
		...actual,
		// Link's title lookup also has `onSuccess`; only the option search is tracked.
		createResource: (config: { onSuccess?: unknown }) => {
			const resource = reactive({
				data: null as { label: string; value: string }[] | null,
				loading: false,
				params: {} as Record<string, unknown>,
				update({ params }: { params: Record<string, unknown> }) {
					resource.params = params
				},
				reload() {
					const txt = String(resource.params.txt ?? '')
					if (!config.onSuccess) searches.push(txt)
					resource.data = ['Database', 'Design', 'Web']
						.filter((name) => name.toLowerCase().includes(txt.toLowerCase()))
						.map((name) => ({ label: name, value: name }))
				},
			})
			return resource
		},
	}
})

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ isSettingsOpen: false }),
}))

Element.prototype.scrollIntoView = () => {}

const mountLink = (trigger?: string) =>
	mount(Link, {
		props: { doctype: 'LMS Category', modelValue: '', trigger },
		attachTo: document.body,
		global: { mocks: { __: (text: string) => text } },
	})

const trigger = () =>
	document.querySelector('[data-slot=trigger]') as HTMLElement

const search = () =>
	document.querySelector('[data-slot=search] input') as HTMLInputElement | null

const items = () =>
	[...document.querySelectorAll('[data-slot=item]')].map((item) =>
		item.textContent?.trim()
	)

const open = async () => {
	trigger().click()
	await flushPromises()
}

const pick = async (wrapper: ReturnType<typeof mountLink>, label: string) => {
	await open()
	const item = [...document.querySelectorAll('[data-slot=item]')].find(
		(row) => row.textContent?.trim() === label
	) as HTMLElement
	item.click()
	await flushPromises()
	await wrapper.setProps({
		modelValue: wrapper.emitted('update:modelValue')!.at(-1)![0] as string,
	})
}

let wrapper: ReturnType<typeof mountLink> | null = null

afterEach(() => {
	wrapper?.unmount()
	wrapper = null
	searches.length = 0
	document.body.innerHTML = ''
	vi.useRealTimers()
})

describe('Link reopen', () => {
	it('opens with an empty search listing every option after a pick', async () => {
		wrapper = mountLink('button')
		await pick(wrapper, 'Database')
		expect(trigger().textContent).toContain('Database')

		await open()
		expect(search()?.value).toBe('')
		expect(searches.at(-1)).toBe('')
		expect(items()).toEqual(['Database', 'Design', 'Web'])
		expect(
			document.querySelector('[data-slot=item][data-state=checked]')
				?.textContent
		).toContain('Database')
	})

	it('searches only what the user types', async () => {
		vi.useFakeTimers()
		wrapper = mountLink('button')
		await pick(wrapper, 'Database')
		await vi.advanceTimersByTimeAsync(400)
		expect(searches).not.toContain('Database')

		await open()
		search()!.value = 'we'
		search()!.dispatchEvent(new Event('input'))
		await vi.advanceTimersByTimeAsync(400)
		expect(searches.at(-1)).toBe('we')
	})
})
