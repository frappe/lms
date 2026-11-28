/**
 * The course editor and chapter form reload the outline through
 * ['course_outline', name], so the outline on screen must use that key, and a
 * student view keeps a key of its own.
 */
import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const route = { query: {} as Record<string, string>, params: {}, hash: '' }
const caches: unknown[] = []
vi.mock('vue-router', () => ({
	useRoute: () => route,
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot /></button>' },
	toast: { error: vi.fn() },
	createResource: (opts: { cache?: unknown }) => {
		caches.push(opts.cache)
		return {
			data: null,
			loading: false,
			reload: vi.fn(),
			fetch: vi.fn(),
			submit: vi.fn(),
		}
	},
}))
vi.mock('vuedraggable', () => ({ default: { template: '<div />' } }))

const { default: CourseOutline } = await import(
	'@/components/CourseOutline.vue'
)

const outlineKey = (query: Record<string, string>) => {
	route.query = query
	caches.length = 0
	shallowMount(CourseOutline, {
		props: { courseName: 'c1', title: '', showOutline: true },
		global: { mocks: { __: (text: string) => text } },
	})
	return caches[0]
}

describe('the course outline cache key', () => {
	it('is the one the editors reload', () => {
		expect(outlineKey({})).toEqual(['course_outline', 'c1'])
	})

	it('is separate in student view', () => {
		expect(outlineKey({ studentView: '1' })).toEqual([
			'course_outline',
			'c1',
			'enrolled',
		])
	})
})
