import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/routes'

describe('public information routes', () => {
	const router = createRouter({ history: createMemoryHistory(), routes })

	it.each([
		['/about', 'About'],
		['/help', 'Help'],
		['/contact', 'Contact'],
		['/privacy', 'Privacy'],
		['/terms', 'Terms'],
	])('resolves %s as a public page', (path, name) => {
		const route = router.resolve(path)
		expect(route.name).toBe(name)
		expect(route.meta.publicPage).toBe(true)
	})
})
