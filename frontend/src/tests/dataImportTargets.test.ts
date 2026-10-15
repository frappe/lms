import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('__', (text: string) => text)

const { pushSettingsHash } = vi.hoisted(() => ({ pushSettingsHash: vi.fn() }))
vi.mock('@/composables/useSettingsHash', () => ({ pushSettingsHash }))

import { importTarget, importTitle } from '@/utils/dataImport'

describe('data import targets', () => {
	const router = { push: vi.fn() } as any

	it('names LMS doctypes the way the app does, and others as they are', () => {
		expect(importTitle('LMS Course')).toBe('Courses')
		expect(importTitle('LMS Category')).toBe('Categories')
		expect(importTitle('ToDo')).toBe('ToDo')
	})

	it('leads back to the course and batch pages', () => {
		importTarget('LMS Course')!.openRecord!(router, 'intro-course')
		expect(router.push).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'intro-course' },
		})
		importTarget('LMS Batch')!.openList(router)
		expect(router.push).toHaveBeenCalledWith({ name: 'Batches' })
	})

	it('opens categories in Settings, where they are managed', () => {
		importTarget('LMS Category')!.openList(router)
		expect(pushSettingsHash).toHaveBeenCalledWith(router, 'categories')
		expect(importTarget('LMS Category')!.openRecord).toBeUndefined()
		expect(importTarget('ToDo')).toBeUndefined()
	})
})
