/**
 * The phone's shared row vocabulary.
 *
 * The mobile settings screens are gone — an LMS is not configured with a thumb —
 * so what is left here are the builders the You page and the desktop settings
 * dialog still share: the colour-mode control and the checkbox seeding the
 * settings doc depends on.
 */
import { describe, expect, it } from 'vitest'
import {
	COLOUR_MODE_ACTION,
	buildAppearanceRows,
	colourModeRow,
	seedCheckboxDefaults,
} from '@/components/Settings/mobileSettings'

describe('seedCheckboxDefaults', () => {
	const sections = [
		{
			columns: [
				{
					fields: [
						{ label: 'On', name: 'on', type: 'checkbox', default: 1 },
						{ label: 'Off', name: 'off', type: 'checkbox' },
						{ label: 'Text', name: 'txt', type: 'text' },
					],
				},
			],
		},
	]

	it('seeds an unset checkbox from its default', () => {
		const doc: Record<string, unknown> = {}
		seedCheckboxDefaults(sections, doc)

		expect(doc).toEqual({ on: 1, off: 0 })
	})

	it('never overwrites a value the server already has', () => {
		const doc: Record<string, unknown> = { on: 0, off: 1 }
		seedCheckboxDefaults(sections, doc)

		expect(doc).toEqual({ on: 0, off: 1 })
	})

	it('treats empty string as unset, the shape Frappe sends for a blank check', () => {
		const doc: Record<string, unknown> = { on: '' }
		seedCheckboxDefaults(sections, doc)

		expect(doc.on).toBe(1)
	})
})

describe('colourModeRow', () => {
	it('reports being picked rather than navigating, so it can open a sheet', () => {
		const row = colourModeRow('dark')

		expect(row.to).toBeUndefined()
		expect(row.action).toBe(COLOUR_MODE_ACTION)
		expect(row.value).toBe('Dark')
	})
})

describe('buildAppearanceRows', () => {
	it('offers the three modes and marks the current one', () => {
		const [group] = buildAppearanceRows('dark')

		expect(group.rows.map((r) => r.label)).toEqual(['System', 'Light', 'Dark'])
		expect(group.rows.filter((r) => r.selected).map((r) => r.key)).toEqual([
			'dark',
		])
	})

	it('reports a choice rather than navigating', () => {
		const [group] = buildAppearanceRows('system')

		expect(group.rows.every((r) => r.to === undefined)).toBe(true)
		expect(group.rows.map((r) => r.action)).toEqual(['system', 'light', 'dark'])
	})
})
