/**
 * The settings tree is pure data, so two invariants hold without mounting
 * anything. Slugs are the URL, and a field offered on two pages would be saved
 * twice from two forms. A draft's baseline is the same contract at runtime.
 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.hoisted(() => {
	// The tree imports every settings page, and one of them reaches @/utils,
	// which pulls in plyr. Plyr touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.stubGlobal('__', (s: string) => s)

import { settingsTree } from '@/components/Settings/settings'
import { NEW_RECORD, useSettingsSource } from '@/composables/useSettingsSource'
import type {
	FieldsPage,
	SettingsField,
	SettingsItem,
	SettingsPage,
} from '@/types/settingsSchema'

const items: SettingsItem[] = settingsTree.flatMap((group) => group.items)

const isFieldsPage = (page: SettingsPage): page is FieldsPage =>
	page.kind === 'fields'

const fieldsOfItem = (item: SettingsItem): SettingsField[] =>
	isFieldsPage(item.page)
		? item.page.sections.flatMap((section) => section.fields)
		: []

describe('the settings tree', () => {
	it('gives every item a unique, URL-safe slug', () => {
		const slugs = items.map((item) => item.slug)

		for (const slug of slugs) {
			expect(slug).toBeTruthy()
			expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
		}
		expect(new Set(slugs).size).toBe(slugs.length)
	})

	it('never shows the same field on two pages', () => {
		const names = items.flatMap((item) =>
			fieldsOfItem(item).map((field) => field.name)
		)

		expect(new Set(names).size).toBe(names.length)
	})
})

// A NEW_RECORD source builds no document resource, so nothing here reaches the
// server and frappe-ui needs no stand-in.
const draftOn = (defaults?: () => Record<string, unknown>) =>
	useSettingsSource(
		{ doctype: 'LMS Badge', record: 'route' },
		{ record: ref(NEW_RECORD), defaults }
	)

describe('a draft opened on defaults', () => {
	it('holds them before anything is typed', () => {
		const source = draftOn(() => ({ event: 'New', user_field: 'member' }))

		expect(source.doc).toMatchObject({ event: 'New', user_field: 'member' })
	})

	it('is not dirty on the defaults alone', () => {
		const source = draftOn(() => ({ event: 'New', user_field: 'member' }))

		expect(source.isDirty).toBe(false)
	})

	it('is dirty once one of them changes', () => {
		const source = draftOn(() => ({ event: 'New', user_field: 'member' }))

		source.doc!.event = 'Manual Assignment'

		expect(source.isDirty).toBe(true)
	})

	it('is dirty once a field the defaults never named is filled', () => {
		const source = draftOn(() => ({ event: 'New' }))

		source.doc!.title = 'Course Champion'

		expect(source.isDirty).toBe(true)
	})

	// The answer for a page that declares none is unchanged: dirty once the draft
	// holds anything worth writing.
	it('falls back to "holds anything" with no defaults declared', () => {
		const source = draftOn()

		expect(source.isDirty).toBe(false)
		source.doc!.title = 'Course Champion'
		expect(source.isDirty).toBe(true)
	})
})
