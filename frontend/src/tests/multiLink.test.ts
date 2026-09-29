/**
 * MultiLink.vue must show its saved values on mount. The search endpoint only
 * returns query hits, so a link control that never resolves its own modelValue
 * renders the placeholder until the user opens the dropdown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import MultiLink from '@/components/Controls/MultiLink.vue'

interface Row {
	value: string
	label: string
}
interface ResourceConfig {
	url: string
	transform?: (rows: Record<string, unknown>[]) => Row[]
	onSuccess?: (rows: Row[]) => void
}
interface FakeResource {
	url: string
	params: Record<string, unknown> | null
	loading: boolean
	data: Row[] | null
	update: (o: { params: Record<string, unknown> }) => void
	reload: () => Promise<void>
	_config: ResourceConfig
}

const COURSES: Record<string, string> = {
	'docker-for-developers': 'Docker for Developers',
	'kubernetes-in-practice': 'Kubernetes in Practice part 1',
}

const USERS: Record<string, string> = {
	'jane@example.com': 'Jane Smith',
	'john@example.com': 'John Doe',
}

// Users the role search would hand back for an empty `txt`. None of them are
// the saved value, so seeing one of these means the by-name path was not used.
const USER_DIRECTORY: Row[] = [
	{ value: 'unrelated1@example.com', label: 'Unrelated One' },
	{ value: 'unrelated2@example.com', label: 'Unrelated Two' },
	...Object.entries(USERS).map(([value, label]) => ({ value, label })),
]

const SEARCH_USERS = 'lms.lms.api.search_users_by_role'

interface Gate {
	promise: Promise<void>
	release: () => void
}

const h = vi.hoisted(() => ({
	resources: [] as FakeResource[],
	searchHits: [] as Row[],
	resolveByName: true,
	// Set to hold every `reload()` open, so the in-flight state can be read.
	gate: null as Gate | null,
}))

function openGate(): Gate {
	let release: () => void = () => {}
	const promise = new Promise<void>((resolve) => {
		release = () => resolve()
	})
	const gate = { promise, release }
	h.gate = gate
	return gate
}

/**
 * Each endpoint is modelled on its real server-side signature. Frappe strips
 * kwargs a whitelisted method does not declare, so params the method has no
 * parameter for simply vanish. A fake that honours `filters.name in` for every
 * url hides exactly the bug this file exists to catch.
 */
function respond(url: string, params: Record<string, unknown>): Row[] {
	if (url === SEARCH_USERS) {
		// (txt, roles, page_length, names): no `doctype`, no `filters`.
		const names = params.names
			? (JSON.parse(String(params.names)) as string[])
			: null
		if (names && h.resolveByName) {
			return names
				.filter((n) => n in USERS)
				.map((n) => ({ value: n, label: USERS[n] }))
		}
		const txt = String(params.txt ?? '').toLowerCase()
		return USER_DIRECTORY.filter(
			(u) => !txt || u.label.toLowerCase().includes(txt)
		).slice(0, Number(params.page_length ?? 10))
	}
	// frappe.desk.search.search_link: honours doctype + filters, ignores `names`.
	const filters = JSON.parse(String(params.filters ?? '{}')) as {
		name?: [string, string[]]
	}
	const names =
		filters.name?.[0] === 'in' && Array.isArray(filters.name?.[1])
			? filters.name[1]
			: null
	if (names && h.resolveByName) {
		return names
			.filter((n) => n in COURSES)
			.map((n) => ({ value: n, label: COURSES[n] }))
	}
	return h.searchHits
}

// The real MultiSelect is used deliberately: the bug lives in how it resolves
// modelValue against `options`, so a stubbed one would not reproduce it.
vi.mock('frappe-ui', async () => {
	const MultiSelect = (
		await import(
			'../../node_modules/frappe-ui/src/components/MultiSelect/MultiSelect.vue'
		)
	).default
	return {
		MultiSelect,
		FormLabel: { props: ['label'], template: `<label>{{ label }}</label>` },
		Button: {
			props: ['variant', 'size', 'ariaLabel'],
			emits: ['click'],
			template: `<button type="button" @click="$emit('click')"><slot /></button>`,
		},
		createResource: (config: ResourceConfig): FakeResource => {
			const res = reactive({
				url: config.url,
				params: null,
				loading: false,
				data: null,
				_config: config,
			}) as FakeResource
			res.update = ({ params }) => {
				res.params = params
			}
			res.reload = async () => {
				res.loading = true
				if (h.gate) await h.gate.promise
				const rows = respond(res.url, res.params ?? {})
				res.data = config.transform
					? config.transform(rows as unknown as Record<string, unknown>[])
					: rows
				config.onSuccess?.(res.data as Row[])
				res.loading = false
			}
			h.resources.push(res)
			return res
		},
	}
})

vi.stubGlobal('__', (s: string) => s)

// jsdom has no scrollIntoView; reka's Listbox calls it as soon as the popover opens.
Element.prototype.scrollIntoView = vi.fn()

// Every mount is attached to the document and its popover is portaled there, so
// a wrapper left mounted outlives its test and the next test's popover lookup
// finds the previous one's. Tracked here and torn down in afterEach.
const mounted: { unmount: () => void }[] = []

function mountLink(
	modelValue: string[],
	disabled = false,
	extraProps: Record<string, unknown> = {},
	slots: Record<string, string> = {}
) {
	const wrapper = mount(MultiLink, {
		props: {
			doctype: 'LMS Course',
			modelValue,
			placeholder: 'Courses',
			disabled,
			...extraProps,
		},
		slots,
		attachTo: document.body,
		// The popover footer renders `__('Clear')`, which resolves through the instance
		// context rather than globalThis. vi.stubGlobal alone does not reach it.
		global: { mocks: { __: (s: string) => s } },
	})
	mounted.push(wrapper)
	return wrapper
}

beforeEach(() => {
	h.resources.length = 0
	h.searchHits = []
	h.resolveByName = true
	h.gate = null
})

afterEach(() => {
	mounted.splice(0).forEach((w) => w.unmount())
})

/** The popover lives in a portal, so it is read off the document, not the wrapper. */
function popoverText(): string {
	const body = document.querySelector('[data-slot="content-body"]')
	return body ? body.textContent ?? '' : ''
}

function selectAllButton(): HTMLButtonElement | undefined {
	return Array.from(document.querySelectorAll('button')).find((b) =>
		(b.textContent ?? '').includes('Select all')
	)
}

function footerLabels(): string[] {
	return Array.from(
		document.querySelectorAll('[data-slot="footer"] button')
	).map((b) => (b.textContent ?? '').trim())
}

function searchResource(): FakeResource | undefined {
	// The search resource is the one the trigger drives; the other is the
	// by-name title lookup, which only ever carries a `names` param.
	return h.resources.find((r) => r.params && !r.params.names)
}

describe('MultiLink saved values', () => {
	it('shows saved values on mount without opening the dropdown', async () => {
		const wrapper = mountLink(['docker-for-developers'])
		await flushPromises()

		const trigger = wrapper.get('button[data-state]')
		expect(trigger.text()).toContain('Docker for Developers')
		expect(trigger.text()).not.toContain('Courses')
	})

	// The trigger no longer spells every label out. The summary suite below covers
	// so what "resolved" means is read off the option map the control exposes,
	// which is also what the consumers using `optionByValue` read.
	it('resolves every saved value, not just the first', async () => {
		const wrapper = mountLink([
			'docker-for-developers',
			'kubernetes-in-practice',
		])
		await flushPromises()

		const byValue = (
			wrapper.vm as unknown as {
				optionByValue: Map<string, { label: string }>
			}
		).optionByValue
		expect(byValue.get('docker-for-developers')?.label).toBe(
			'Docker for Developers'
		)
		expect(byValue.get('kubernetes-in-practice')?.label).toBe(
			'Kubernetes in Practice part 1'
		)
	})

	it('falls back to the raw docname when the label cannot be resolved', async () => {
		h.resolveByName = false
		const wrapper = mountLink(['unknown-course'])
		await flushPromises()

		expect(wrapper.get('button[data-state]').text()).toContain('unknown-course')
	})

	it('renders the placeholder when nothing is selected', async () => {
		const wrapper = mountLink([])
		await flushPromises()

		expect(wrapper.get('button[data-state]').text()).toContain('Courses')
	})

	it('does not fetch when there is nothing to resolve', async () => {
		mountLink([])
		await flushPromises()

		expect(h.resources.every((r) => r.params === null)).toBe(true)
	})
})

describe('MultiLink saved values on a custom search endpoint', () => {
	// lms.lms.api.search_users_by_role takes (txt, roles, page_length, names).
	// Resolving saved values with `filters` alone made it an empty-txt search:
	// instructor chips kept showing raw emails and the dropdown was pre-seeded
	// with whoever the search happened to return.
	function mountUsers(modelValue: string[]) {
		return mountLink(modelValue, false, {
			doctype: 'User',
			url: SEARCH_USERS,
			placeholder: 'Instructors',
			searchParams: { roles: JSON.stringify(['Course Creator']) },
		})
	}

	it('resolves saved values by name, not by filters', async () => {
		const wrapper = mountUsers(['jane@example.com'])
		await flushPromises()

		const text = wrapper.get('button[data-state]').text()
		expect(text).toContain('Jane Smith')
		expect(text).not.toContain('jane@example.com')
	})

	it('sends the saved names to the endpoint', async () => {
		mountUsers(['jane@example.com', 'john@example.com'])
		await flushPromises()

		const called = h.resources.filter((r) => r.params)
		expect(called.length).toBeGreaterThan(0)
		expect(
			called.some(
				(r) =>
					String(r.params?.names) ===
					JSON.stringify(['jane@example.com', 'john@example.com'])
			)
		).toBe(true)
	})

	it('does not seed unrelated rows as resolved options', async () => {
		// Model an endpoint that ignores the by-name path entirely: whatever it
		// returns is a search hit and must never be recorded as a resolution.
		h.resolveByName = false
		const wrapper = mountUsers(['jane@example.com'])
		await flushPromises()

		const byValue = (
			wrapper.vm as unknown as { optionByValue: Map<string, unknown> }
		).optionByValue
		expect(byValue.has('unrelated1@example.com')).toBe(false)
		expect(wrapper.get('button[data-state]').text()).toContain(
			'jane@example.com'
		)
	})
})

describe('MultiLink disabled', () => {
	// A frozen (foreign or read-only) Raven rule locks every control on its card;
	// without this the two link pickers stayed clickable and the freeze leaked.
	it('does not open the dropdown when disabled', async () => {
		const wrapper = mountLink(['docker-for-developers'], true)
		await flushPromises()

		const trigger = wrapper.get('button[data-state]')
		expect(trigger.attributes('disabled')).toBeDefined()

		await trigger.trigger('click')
		expect(trigger.attributes('data-state')).toBe('closed')
	})

	it('still shows its saved values while disabled', async () => {
		const wrapper = mountLink(['docker-for-developers'], true)
		await flushPromises()

		expect(wrapper.get('button[data-state]').text()).toContain(
			'Docker for Developers'
		)
	})

	it('opens normally when not disabled', async () => {
		const wrapper = mountLink(['docker-for-developers'])
		await flushPromises()

		const trigger = wrapper.get('button[data-state]')
		expect(trigger.attributes('disabled')).toBeUndefined()

		await trigger.trigger('click')
		expect(trigger.attributes('data-state')).toBe('open')
	})
})

describe('MultiLink trigger', () => {
	// The control drew its own trigger, with focus and open styling written by
	// hand rather than taken from the theme: `border-outline-gray-8` is gray-900,
	// so the box was outlined in near-black, and `outline-none` suppressed the
	// theme's own soft focus ring in favour of a white `focus-visible` fill that
	// made that near-black border read as a hard ring the moment it was focused
	// or opened. MultiSelect's own trigger is used instead.
	it("is frappe-ui's own trigger, not a hand-rolled one", async () => {
		const wrapper = mountLink([])
		await flushPromises()

		const trigger = wrapper.get('button[data-state]')
		expect(trigger.attributes('data-slot')).toBe('trigger')
		expect(trigger.attributes('aria-haspopup')).toBe('listbox')
	})

	it('carries no focus or open colours of its own', async () => {
		const wrapper = mountLink([])
		await flushPromises()

		const classes = wrapper.get('button[data-state]').classes()
		expect(classes).not.toContain('outline-none')
		expect(classes).not.toContain('border-outline-gray-8')
		expect(classes.filter((c) => c.startsWith('focus-visible:'))).toEqual([])
		expect(
			classes.filter(
				(c) =>
					c.startsWith('data-[state=open]:') &&
					c !== 'data-[state=open]:focus-ring'
			)
		).toEqual([])
	})

	it('carries the aria wiring for its label, error and requiredness', async () => {
		const wrapper = mountLink([], false, {
			label: 'Courses',
			error: 'Pick at least one',
			required: true,
		})
		await flushPromises()

		const trigger = wrapper.get('button[data-state]')
		expect(trigger.attributes('aria-required')).toBe('true')
		expect(trigger.attributes('aria-invalid')).toBe('true')
		expect(trigger.attributes('aria-errormessage')).toBeTruthy()
		expect(trigger.attributes('id')).toBeTruthy()
	})
})

describe('MultiLink trigger summary', () => {
	// MultiLink used to write the trigger label itself, joining every selected
	// label with ", ". That is MultiSelect's job and MultiSelect does it
	// differently, one label for one selection and "N selected" beyond that, which
	// is what keeps the trigger from growing with the selection. Taking its
	// default is the whole point of dropping the hand-rolled trigger.
	it('reads the label itself when one thing is selected', async () => {
		const wrapper = mountLink(['docker-for-developers'])
		await flushPromises()

		expect(wrapper.get('button[data-state]').text()).toContain(
			'Docker for Developers'
		)
	})

	it('collapses two or more selections to a count', async () => {
		const wrapper = mountLink([
			'docker-for-developers',
			'kubernetes-in-practice',
		])
		await flushPromises()

		const text = wrapper.get('button[data-state]').text()
		expect(text).toContain('2 selected')
		expect(text).not.toContain('Docker for Developers')
	})

	// The slot is still forwarded, so a field that does need every label spelled
	// out can say so, it just is not what an unconfigured MultiLink does.
	it('lets a consumer write the summary itself', async () => {
		const wrapper = mountLink(
			['docker-for-developers', 'kubernetes-in-practice'],
			false,
			{},
			{
				summary: `<template #default="p">{{ p.selected.map((o) => o.label).join(' + ') }}</template>`,
			}
		)
		await flushPromises()

		const text = wrapper.get('button[data-state]').text()
		expect(text).toContain('Docker for Developers + Kubernetes in Practice')
		expect(text).not.toContain('2 selected')
	})
})

describe('MultiLink prefix slot', () => {
	// Two forms render stacked instructor avatars in front of the trigger. The
	// slot is MultiSelect's now, so its props are the ones a consumer gets
	// plus `selected`, the name MultiLink's own trigger handed over.
	it('hands the prefix slot the selection under both names', async () => {
		const wrapper = mountLink(
			['docker-for-developers'],
			false,
			{},
			{
				prefix: `<template #default="p"><span data-testid="pfx">{{ p.selected.length }}/{{ p.selectedOptions.length }}/{{ p.open }}</span></template>`,
			}
		)
		await flushPromises()

		expect(wrapper.get('[data-testid="pfx"]').text()).toBe('1/1/false')
	})
})

describe('MultiLink while its search is in flight', () => {
	// MultiSelect shows `emptyText` whenever it has no options and was not told
	// it is loading. MultiLink never told it, so every dropdown opened reading
	// "No results" and only then filled in, which is what a picker pointed at a
	// doctype with plenty of records looked like it was saying.
	it('does not read as empty before the first search answers', async () => {
		h.searchHits = [{ value: 'b1', label: 'TZ Demo — Noumea' }]
		const gate = openGate()
		const wrapper = mountLink([])
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()
		expect(popoverText()).not.toContain('No results')

		gate.release()
		h.gate = null
		await flushPromises()
		expect(popoverText()).toContain('TZ Demo — Noumea')
	})

	it('says "No results" once the search has answered with nothing', async () => {
		h.searchHits = []
		const wrapper = mountLink([])
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()
		expect(popoverText()).toContain('No results')
	})
})

describe('MultiLink search query', () => {
	// The query is bound so the typed text can reach the server search. That also
	// makes MultiSelect treat it as the consumer's and never reset it, so a
	// control reopened after a fruitless search stayed filtered by the old text
	// over the old (empty) result set.
	it('clears the query when the popover closes', async () => {
		h.searchHits = [{ value: 'b1', label: 'TZ Demo — Noumea' }]
		const wrapper = mountLink([])
		await flushPromises()

		const trigger = wrapper.get('button[data-state]')
		await trigger.trigger('click')
		await flushPromises()

		const input = document.querySelector(
			'input[data-slot="input"]'
		) as HTMLInputElement
		input.value = 'nothing matches this'
		input.dispatchEvent(new Event('input'))
		await flushPromises()

		await trigger.trigger('click')
		await flushPromises()
		await trigger.trigger('click')
		await flushPromises()

		const reopened = document.querySelector(
			'input[data-slot="input"]'
		) as HTMLInputElement
		expect(reopened.value).toBe('')
	})

	// The options come from a server search, so MultiSelect's own substring pass
	// over label and value is a second, narrower filter stacked on top of it. A
	// doctype whose search fields go beyond its name and title, or a `transform`
	// that relabels the rows, hands back hits that pass the server and fail the
	// client, and those were being dropped between the two.
	it('keeps server hits whose label and value do not contain the typed text', async () => {
		h.searchHits = [
			{ value: 'docker-for-developers', label: 'Docker for Developers' },
		]
		const wrapper = mountLink([])
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()

		const input = document.querySelector(
			'input[data-slot="input"]'
		) as HTMLInputElement
		input.value = 'containers'
		input.dispatchEvent(new Event('input'))
		await flushPromises()

		expect(popoverText()).toContain('Docker for Developers')
		expect(popoverText()).not.toContain('No results')
	})

	// A Raven condition row swaps the doctype of its value cell in place when the
	// rule type changes, and Vue reuses the same MultiLink across that swap.
	it('re-queries when the doctype changes under it', async () => {
		const wrapper = mountLink([])
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()
		expect(searchResource()?.params?.doctype).toBe('LMS Course')

		await wrapper.setProps({ doctype: 'LMS Batch' })
		await flushPromises()
		expect(searchResource()?.params?.doctype).toBe('LMS Batch')
	})
})

describe('MultiLink select all', () => {
	// Off by default: on a picker naming a few specific records, an all-of button
	// beside Clear is only a way to get it wrong in one click.
	it('offers no select-all unless asked for', async () => {
		h.searchHits = [{ value: 'b1', label: 'One' }]
		const wrapper = mountLink([])
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()
		expect(popoverText()).not.toContain('Select all')
	})

	// It selects what is listed, the current page of the server search plus any
	// values already resolved, not every record the doctype holds. The label
	// says "Select all" regardless, by request.
	it('selects every option currently listed', async () => {
		h.searchHits = [
			{ value: 'b1', label: 'One' },
			{ value: 'b2', label: 'Two' },
		]
		const wrapper = mountLink([], false, { allowSelectAll: true })
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()

		const button = selectAllButton()
		expect(button).toBeTruthy()
		button?.click()
		await flushPromises()

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
			'b1',
			'b2',
		])
	})

	// The endpoint answers one page, `page_length` defaults to 10 server-side
	// so a doctype with more rows than that has rows this button will not reach.
	// The label reads "Select all" by request; this is the gap that leaves.
	it('reaches only the loaded page, not the rest of the doctype', async () => {
		h.searchHits = Array.from({ length: 10 }, (_, i) => ({
			value: `b${i}`,
			label: `Batch ${i}`,
		}))
		const wrapper = mountLink([], false, { allowSelectAll: true })
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()

		selectAllButton()?.click()
		await flushPromises()

		const selected = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
		expect(selected).toHaveLength(10)
		expect(selected).not.toContain('b10')
	})

	it('sits opposite Clear, on the end edge of the footer', async () => {
		// Clear and Select all were grouped together on the start edge, so the
		// footer read as one two-button cluster. They are the two opposite
		// answers to "which of these?", and now sit on opposite edges.
		h.searchHits = [{ value: 'b1', label: 'One' }]
		const wrapper = mountLink([], false, { allowSelectAll: true })
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()

		expect(footerLabels()).toEqual(['Clear', 'Select all'])
		const footer = document.querySelector('[data-slot="footer"] > div')!
		expect(footer.className.split(' ')).toContain('justify-between')
		// Two edge children, not one cluster: Clear alone, then the rest.
		expect(footer.children).toHaveLength(2)
		expect(footer.children[0].textContent?.trim()).toBe('Clear')
		expect(footer.children[1].lastElementChild?.textContent?.trim()).toBe(
			'Select all'
		)
	})

	// The two are never passed together today, select-all is opted into by the
	// Raven condition field, `onCreate` by the instructor pickers, so this pins
	// the layout that assumption is hiding: Clear keeps the start edge alone and
	// Select all keeps the end edge, with Create New between them.
	it('keeps Clear and Select all on the edges when Create New is there too', async () => {
		h.searchHits = [{ value: 'b1', label: 'One' }]
		const wrapper = mountLink([], false, {
			allowSelectAll: true,
			onCreate: () => {},
		})
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()

		expect(footerLabels()).toEqual(['Clear', 'Create New', 'Select all'])
	})

	it('selects nothing when the list is empty', async () => {
		h.searchHits = []
		const wrapper = mountLink([], false, { allowSelectAll: true })
		await flushPromises()

		await wrapper.get('button[data-state]').trigger('click')
		await flushPromises()

		selectAllButton()?.click()
		await flushPromises()

		const selected = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
		expect(selected ?? []).toEqual([])
	})
})
