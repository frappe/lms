/** What a submissions list declares. One config per assessment type. */

import type { RouteLocationRaw } from 'vue-router'
import type { Breadcrumb, ListColumn, ListRow } from './listPage'

// One filter control: `doctype` draws a Link, `options` a Select. `key` is both
// the fieldname filtered on and the URL query key.
export interface SubmissionFilterField {
	key: string
	/** Raw English; translated by the page, and doubles as the control's name. */
	placeholder: string
	doctype?: string
	options?: { label: string; value: string }[]
}

// The middle crumb, naming the assessment the list is scoped to.
export interface SubmissionScopeCrumb {
	filterKey: string
	doctype: string
	titleField: string
	route: (value: string) => RouteLocationRaw
}

// Raw (the page translates): title, pageTitle, filters[].placeholder, emptyName.
// Translated by the caller: parentCrumb.label, columns[].label and
// filters[].options[].label, which reach the DOM verbatim.
export interface SubmissionsConfig {
	doctype: string
	fields: string[]
	orderBy: string
	columns: ListColumn[]
	filters: SubmissionFilterField[]
	getRowRoute: (row: ListRow) => RouteLocationRaw
	parentCrumb: Breadcrumb
	scopeCrumb?: SubmissionScopeCrumb
	/** Heading above the list. Raw English; translated by the page. */
	title: string
	/** document.title for the page. Raw English; translated by the page. */
	pageTitle: string
	/** Raw English, and left untranslated — ListPage frames it. */
	emptyName: string
	emptyIcon: string
	transform?: (rows: ListRow[]) => ListRow[]
}
