/**
 * Cached resources whose callbacks write to component-local state.
 *
 * frappe-ui's createResource / createListResource return the *previously
 * created* instance on a cache hit and, at most, call reload() on it — the new
 * component's `transform` / `onSuccess` closures are never attached
 * (node_modules/frappe-ui/src/resources/resources.js:9-20, listResource.js:15-22).
 *
 * That is harmless when the component only reads `resource.data`, because the
 * data lives on the shared instance. It breaks whenever a callback writes to a
 * ref that belongs to the component: after a remount the reload runs the *dead*
 * instance's closure, and the live component's ref is never filled. That is the
 * mechanism behind issue #2559, and VideoStatistics.vue carried the same shape —
 * its onSuccess picks the initial tab, so a reopened dialog rendered no tab at
 * all.
 *
 * The mock below reproduces frappe-ui's real cache semantics, so this suite
 * fails against any component that reintroduces the pattern.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import VideoStatistics from '@/components/Modals/VideoStatistics.vue'

// tsconfig sets `types: []`, so node's globals aren't ambient here.
declare const process: { cwd(): string }
const SRC = join(process.cwd(), 'src')

const ROWS = [
	{
		name: 'w1',
		member: 'a@b.c',
		member_name: 'A',
		member_image: '',
		member_username: 'a',
		source: 'Lesson',
		watch_time: '12',
	},
	{
		name: 'w2',
		member: 'd@e.f',
		member_name: 'D',
		member_image: '',
		member_username: 'd',
		source: 'Batch',
		watch_time: '30',
	},
]

// Mirrors frappe-ui: keyed by the cache option, first instance wins, a hit only
// gets reload() called on it.
const listCache = new Map<string, any>()

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')

	const createListResource = (options: any) => {
		const key = options.cache ? JSON.stringify(options.cache) : null
		if (key && listCache.has(key)) {
			const hit = listCache.get(key)
			if (hit.auto) void hit.reload()
			return hit
		}

		const resource: any = reactive({
			auto: options.auto,
			data: null,
			loading: false,
			filters: options.filters ?? {},
			update: (patch: any) => Object.assign(resource, patch),
			reload: async () => {
				await Promise.resolve()
				resource.data = structuredClone(ROWS)
				options.onSuccess?.(resource.data)
				return resource.data
			},
		})
		resource.fetch = resource.reload
		if (key) listCache.set(key, resource)
		return resource
	}

	const passthrough = { template: '<div><slot /></div>' }
	return {
		createListResource,
		Avatar: passthrough,
		Dialog: { props: ['open'], template: '<div><slot /></div>' },
		FormControl: passthrough,
		NumberChart: passthrough,
		TabButtons: passthrough,
	}
})

vi.mock('@/components/VideoBlock.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/NumberChartGraph.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils', () => ({
	enablePlyr: vi.fn(),
	formatTimestamp: (v: number) => String(v),
}))

vi.stubGlobal('__', (s: string) => s)

// At runtime `__('Video {0}')` returns a formatter object, not a string
// (translation.js), and the tab labels call `.format` on it. The stub above
// returns the string itself, so give String the same method — the same shim
// assignmentsCount.test.ts and settingsList.test.ts use.
;(String.prototype as any).format ??= function (...args: unknown[]) {
	return String(this).replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

const mountDialog = () =>
	mount(VideoStatistics, {
		props: { modelValue: true, lessonName: 'lesson-1', lessonTitle: 'L1' },
		global: { mocks: { __: (s: string) => s }, stubs: { teleport: true } },
	})

describe('VideoStatistics.vue across a remount', () => {
	beforeEach(() => {
		listCache.clear()
	})

	it('picks the initial tab on a fresh mount', async () => {
		const wrapper = mountDialog()
		await (wrapper.vm as any).statistics.reload()
		await flushPromises()

		expect((wrapper.vm as any).currentTab).toBe('Lesson')
		wrapper.unmount()
	})

	it('picks the initial tab again after the dialog is reopened', async () => {
		// First open — this is the instance whose closures a cache would keep.
		const first = mountDialog()
		await (first.vm as any).statistics.reload()
		await flushPromises()
		expect((first.vm as any).currentTab).toBe('Lesson')
		first.unmount()

		// Second open. With a cache option the reload here runs the unmounted
		// component's onSuccess and this instance's currentTab stays empty.
		const second = mountDialog()
		await (second.vm as any).statistics.reload()
		await flushPromises()

		expect((second.vm as any).currentTab).toBe('Lesson')
		second.unmount()
	})
})

/**
 * The behavioural test above can only cover a component cheap enough to mount.
 * Lesson.vue and ProgramForm.vue carry the same defect and are not, so this
 * pins them at the source level instead: the resources whose onSuccess writes
 * to a component ref must not declare `cache`.
 *
 * It proves less than a mount — it cannot catch a NEW resource growing the same
 * shape — but it does stop the specific regression of someone restoring these
 * four cache keys (a merge resolution, or "re-enable the offline cache") and
 * still seeing green.
 */
describe('resources that write component state declare no cache', () => {
	// [file, the option that identifies the resource inside that file]
	const GUARDED: ReadonlyArray<readonly [string, string]> = [
		[
			'components/Modals/VideoStatistics.vue',
			"doctype: 'LMS Video Watch Duration'",
		],
		['pages/Lesson.vue', "doctype: 'LMS Lesson Note'"],
		['pages/Forms/ProgramForm.vue', "doctype: 'LMS Program Course'"],
		['pages/Forms/ProgramForm.vue', "doctype: 'LMS Program Member'"],
	]

	/** The createResource/createListResource call enclosing `marker`. */
	const resourceBlock = (source: string, marker: string): string => {
		const at = source.indexOf(marker)
		expect(at, `${marker} not found`).toBeGreaterThan(-1)
		// The NEAREST preceding call of either kind. Preferring createListResource
		// outright would walk past a closer createResource — in a file holding
		// both, the block returned would be a different resource's, and the
		// assertion below would pass without ever looking at the guarded one.
		const start = Math.max(
			source.lastIndexOf('createListResource(', at),
			source.lastIndexOf('createResource(', at)
		)
		expect(start, `no createResource call before ${marker}`).toBeGreaterThan(-1)
		let depth = 0
		for (let i = source.indexOf('(', start); i < source.length; i++) {
			if (source[i] === '(') depth++
			else if (source[i] === ')' && --depth === 0)
				return source.slice(start, i + 1)
		}
		throw new Error(`unbalanced parentheses after ${marker}`)
	}

	it.each(GUARDED)('%s / %s', (file, marker) => {
		const source = readFileSync(join(SRC, file), 'utf8')
		expect(resourceBlock(source, marker)).not.toMatch(/\bcache\s*:/)
	})
})
