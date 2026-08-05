/**
 * MultiLink.vue must show its saved values on mount. The search endpoint only
 * returns query hits, so a link control that never resolves its own modelValue
 * renders the placeholder until the user opens the dropdown.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
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

const h = vi.hoisted(() => ({
	resources: [] as FakeResource[],
	searchHits: [] as Row[],
	resolveByName: true,
}))

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

function mountLink(
	modelValue: string[],
	disabled = false,
	extraProps: Record<string, unknown> = {}
) {
	return mount(MultiLink, {
		props: {
			doctype: 'LMS Course',
			modelValue,
			placeholder: 'Courses',
			disabled,
			...extraProps,
		},
		attachTo: document.body,
		// The popover footer renders `__('Clear')`, which resolves through the instance
		// context rather than globalThis. vi.stubGlobal alone does not reach it.
		global: { mocks: { __: (s: string) => s } },
	})
}

beforeEach(() => {
	h.resources.length = 0
	h.searchHits = []
	h.resolveByName = true
})

describe('MultiLink saved values', () => {
	it('shows saved values on mount without opening the dropdown', async () => {
		const wrapper = mountLink(['docker-for-developers'])
		await flushPromises()

		const trigger = wrapper.get('button[data-state]')
		expect(trigger.text()).toContain('Docker for Developers')
		expect(trigger.text()).not.toContain('Courses')
	})

	it('shows every saved value, not just the first', async () => {
		const wrapper = mountLink([
			'docker-for-developers',
			'kubernetes-in-practice',
		])
		await flushPromises()

		const text = wrapper.get('button[data-state]').text()
		expect(text).toContain('Docker for Developers')
		expect(text).toContain('Kubernetes in Practice part 1')
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
	// A frozen (Paused) Raven rule locks every control on its card; without this the
	// two link pickers stayed clickable and the freeze leaked.
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
