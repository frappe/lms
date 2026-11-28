import { call } from 'frappe-ui'
import type { RouteLocationRaw, Router } from 'vue-router'
import { MODAL_FORM_ROUTES } from '@/components/CommandPalette/paletteTypes'
import { openFormRoute } from '@/composables/useFormRoute'
import { getLmsBasePath } from '@/utils/basePath'
import { openExternal } from '@/utils/openExternal'
import {
	getDoctypeFromSlug,
	getListRoute,
	getRecordRoute,
	getRecordRouteFields,
	type RecordRouteContext,
	type RecordValues,
} from '@/utils/recordRoutes'

const FLOW_HOST = 'flow-launcher'
const DESK_PREFIXES = new Set(['desk', 'app'])

/** Where a link in Flow's chat points, when the LMS has a page for it. */
export type FlowLinkTarget =
	| { kind: 'page'; path: string }
	| { kind: 'record'; doctype: string; name: string }
	| { kind: 'list'; doctype: string }

const decode = (segment: string): string => {
	try {
		return decodeURIComponent(segment)
	} catch {
		return segment
	}
}

/**
 * Reads an LMS page (`/lms/...`) or a Desk record or list of an LMS doctype
 * (`/desk/<slug>/<name>`, `/app/...`) out of a link. Anything else is null and
 * keeps its own behaviour.
 */
export function parseFlowLink(
	href: string,
	origin: string = window.location.origin,
	base: string = getLmsBasePath()
): FlowLinkTarget | null {
	let url: URL
	try {
		url = new URL(href, origin)
	} catch {
		return null
	}
	if (url.origin !== origin) return null
	const [prefix, slug, ...rest] = url.pathname.split('/').filter(Boolean)
	if (prefix === base) {
		const path = url.pathname.slice(base.length + 1) || '/'
		return { kind: 'page', path: path + url.search + url.hash }
	}
	if (!DESK_PREFIXES.has(prefix) || !slug) return null
	const doctype = getDoctypeFromSlug(slug)
	if (!doctype) return null
	if (!rest.length || rest[0] === 'view') return { kind: 'list', doctype }
	if (rest[0] === 'new') return null
	return { kind: 'record', doctype, name: decode(rest.join('/')) }
}

async function getRecordValues(
	doctype: string,
	name: string
): Promise<RecordValues> {
	const fields = getRecordRouteFields(doctype)
	if (!fields.length) return {}
	return (
		(await call('frappe.client.get_value', {
			doctype,
			filters: name,
			fieldname: fields,
		})) ?? {}
	)
}

/** The route a target opens, or null when the record has no LMS page. */
export async function getFlowLinkRoute(
	target: FlowLinkTarget,
	context: RecordRouteContext
): Promise<RouteLocationRaw | null> {
	if (target.kind === 'page') return target.path
	if (target.kind === 'list') return getListRoute(target.doctype)
	const values = await getRecordValues(target.doctype, target.name)
	return getRecordRoute(target.doctype, target.name, context, values)
}

/** A route that needs no lookup, for a link opened in a new tab. */
function getSyncRoute(
	target: FlowLinkTarget,
	context: RecordRouteContext
): RouteLocationRaw | null {
	if (target.kind === 'page') return null
	if (target.kind === 'list') return getListRoute(target.doctype)
	return getRecordRoute(target.doctype, target.name, context)
}

function openRoute(router: Router, to: RouteLocationRaw) {
	const name = typeof to === 'object' && 'name' in to ? to.name : null
	if (typeof name === 'string' && MODAL_FORM_ROUTES.has(name))
		return openFormRoute(router, to)
	return router.push(to)
}

/** The link a click inside Flow's panel landed on; the chat sits in a shadow root. */
function getFlowAnchor(event: MouseEvent): HTMLAnchorElement | null {
	const path = event.composedPath()
	if (
		!path.some(
			(node) => node instanceof Element && node.localName === FLOW_HOST
		)
	)
		return null
	const anchor = path.find((node) => node instanceof HTMLAnchorElement)
	return anchor instanceof HTMLAnchorElement && anchor.href ? anchor : null
}

const opensElsewhere = (event: MouseEvent): boolean =>
	event.button !== 0 ||
	event.metaKey ||
	event.ctrlKey ||
	event.shiftKey ||
	event.altKey

/**
 * Opens the LMS page for links in Flow's chat that point at an LMS record on
 * Desk or at an LMS page, in this tab through the router. A link opened in a
 * new tab is pointed at the LMS page when that needs no lookup. Returns the
 * function that stops it.
 */
export function routeFlowLinks(
	router: Router,
	getContext: () => RecordRouteContext
): () => void {
	const onClick = (event: MouseEvent) => {
		if (event.defaultPrevented) return
		const anchor = getFlowAnchor(event)
		const target = anchor && parseFlowLink(anchor.href)
		if (!anchor || !target) return
		if (opensElsewhere(event)) {
			const to = getSyncRoute(target, getContext())
			if (to) anchor.href = router.resolve(to).href
			return
		}
		event.preventDefault()
		// no LMS page for it after all: open the link as the chat meant to
		const openLink = () => openExternal(anchor.href)
		getFlowLinkRoute(target, getContext())
			.then((to) => (to ? openRoute(router, to) : openLink()))
			.catch(openLink)
	}
	document.addEventListener('click', onClick)
	document.addEventListener('auxclick', onClick)
	return () => {
		document.removeEventListener('click', onClick)
		document.removeEventListener('auxclick', onClick)
	}
}
