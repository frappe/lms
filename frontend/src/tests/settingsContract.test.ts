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

// The tree imports every settings page, and several of them import
// `@framework/ui/telemetry` and/or `@framework/ui/components/Onboarding`. Both
// must resolve, even though nothing here mounts a component.
vi.mock('@framework/ui/telemetry/index', () => ({}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({}))

import { settingsTree } from '@/components/Settings/settings'
import { NEW_RECORD, useSettingsSource } from '@/composables/useSettingsSource'
import type {
	CheckboxOption,
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

// The fields a page writes: a checkbox group writes its options, not itself.
const writtenOf = (item: SettingsItem): (SettingsField | CheckboxOption)[] =>
	fieldsOfItem(item).flatMap((field) =>
		field.type === 'checkboxGroup' ? field.options : [field]
	)

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
			writtenOf(item).map((field) => field.name)
		)

		expect(new Set(names).size).toBe(names.length)
	})

	// Settings.vue binds the record model only where `records` is declared.
	// Without it the page keeps the record in local state: Back skips the
	// dirty guard and a refresh loses the open record.
	it('declares records on every custom page that opens a record', () => {
		const undeclared = items
			.filter((item) => item.page.kind === 'custom' && !item.records)
			.filter((item) => {
				const props = (item.page as { component: { props?: object } }).component
					.props
				return Boolean(props && 'record' in props)
			})
			.map((item) => item.slug)

		expect(undeclared).toEqual([])
	})

	// Regression: currency picker 403 for LMS roles (#3023, fixed in #3038).
	it('searches every Currency link through the LMS query', () => {
		const currencyLinks = items
			.flatMap(fieldsOfItem)
			.filter((field) => field.type === 'link' && field.doctype === 'Currency')

		expect(currencyLinks).not.toHaveLength(0)
		for (const field of currencyLinks) {
			expect(field).toHaveProperty('query', 'lms.lms.api.search_currencies')
		}
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

describe('the course progress descriptions', () => {
	const progressItem = items.find((item) => item.slug === 'course-progress')!
	const fieldOf = (name: string) =>
		writtenOf(progressItem).find((field) => field.name === name)

	it('groups the enforce fields, with Prevent Skipping Videos after', () => {
		const page = progressItem.page as FieldsPage
		expect(page.sections.map((section) => section.label)).toEqual([
			'Lesson Completion',
		])
		expect(fieldsOfItem(progressItem).map((field) => field.type)).toEqual([
			'number',
			'checkboxGroup',
			'checkboxGroup',
			'checkbox',
		])
		expect(writtenOf(progressItem).map((field) => field.name)).toEqual([
			'lesson_dwell_time',
			'enforce_video_completion',
			'enforce_quiz_completion',
			'enforce_assignment_completion',
			'enforce_programming_exercise_completion',
			'enforce_quiz_passing',
			'enforce_open_ended_quiz_passing',
			'enforce_assignment_passing',
			'enforce_programming_exercise_passing',
			'prevent_skipping_videos',
		])
	})

	// Regression on this branch only, no upstream PR: a pass only counts for a gated item.
	// Added on fix/course-progress-enforcement (no PR yet).
	it('ties each passing switch to its completion switch', () => {
		const passing = writtenOf(progressItem).flatMap((field) =>
			'requires' in field && field.requires
				? [[field.name, field.requires]]
				: []
		)
		expect(passing).toEqual([
			['enforce_quiz_passing', 'enforce_quiz_completion'],
			['enforce_open_ended_quiz_passing', 'enforce_quiz_completion'],
			['enforce_assignment_passing', 'enforce_assignment_completion'],
			[
				'enforce_programming_exercise_passing',
				'enforce_programming_exercise_completion',
			],
		])
	})

	// Regression from #2426: the copy claimed every video is enforced, but
	// embedded providers cannot be tracked. Added on fix/course-progress-enforcement (no PR yet).
	it.each(['enforce_video_completion', 'prevent_skipping_videos'])(
		'%s names the providers it cannot enforce in its caution',
		(name) => {
			const field = fieldOf(name)
			for (const provider of ['Cloudflare Stream', 'Google Drive', 'Aparat'])
				expect(field?.caution).toContain(provider)
		}
	)
})
