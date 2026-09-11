import { NEW_RECORD } from '@/composables/useSettingsSource'
import type {
	DetailPage,
	FieldsPage,
	FieldsSection,
} from '@/types/settingsSchema'
import type { SettingsListRow } from '@/types'

/**
 * One record form, serving both the New page and a list's row: same fields,
 * save mode and header, differing only in the document's origin. Declared
 * once, called via `forNew()` / `forRecord()`.
 */
export interface RecordForm {
	/** The page as it opens on a record the list already has. */
	forRecord: () => DetailPage
	/** The page as it opens to create one. */
	forNew: () => DetailPage
}

export interface RecordFormOptions {
	doctype: string
	sections: FieldsSection[]
	/** Autosave, or an explicit Save button. Record forms are usually manual. */
	save?: FieldsPage['save']
	/** Fieldname whose toggle is hoisted into the header. */
	enabledField?: string
	/** Fieldname whose value IS the document's name; editing it renames. */
	renameField?: string
	/** Supplies `reqd` at runtime where the server owns it. */
	meta?: FieldsPage['meta']
	/** What a new record opens holding, and its dirty baseline. */
	defaults?: FieldsPage['defaults']
	/** The first thing wrong with the document, before the server is asked. */
	validate?: FieldsPage['validate']
	/** The toast, the telemetry and the way back, once a save lands. */
	onSaved?: FieldsPage['onSaved']
	/** Header for the New page. */
	newTitle: () => string
	/**
	 * Header for an existing record. Called with an empty row for a deep link to
	 * a record the list has not fetched yet, so it has to tolerate one.
	 */
	recordTitle: (row: SettingsListRow) => string
}

export function recordForm(options: RecordFormOptions): RecordForm {
	const shared = {
		kind: 'fields' as const,
		save: options.save ?? ('manual' as const),
		sections: options.sections,
		...(options.enabledField ? { enabledField: options.enabledField } : {}),
		...(options.renameField ? { renameField: options.renameField } : {}),
		...(options.meta ? { meta: options.meta } : {}),
		...(options.defaults ? { defaults: options.defaults } : {}),
		...(options.validate ? { validate: options.validate } : {}),
		...(options.onSaved ? { onSaved: options.onSaved } : {}),
	}

	return {
		forRecord: () => ({
			...shared,
			source: { doctype: options.doctype, record: 'route' },
			title: options.recordTitle,
		}),
		// NEW_RECORD, not an empty name: that reserved id is what makes Save an
		// insert rather than a write to a document that does not exist.
		forNew: () => ({
			...shared,
			source: { doctype: options.doctype, name: NEW_RECORD },
			title: options.newTitle,
		}),
	}
}
