type IconNode = [string, Record<string, string>][]

const FALLBACK_ICON = 'book-open'
const styled = new Set<string>()
let iconNodes: Promise<Record<string, IconNode>> | null = null
let iconTags: Promise<Record<string, string[]>> | null = null
let sheet: CSSStyleSheet | null = null

/** Every lucide icon's SVG nodes, fetched once as its own chunk. */
export function loadIconNodes(): Promise<Record<string, IconNode>> {
	iconNodes ||= import('lucide-static/icon-nodes.json').then(
		(module) => module.default as unknown as Record<string, IconNode>
	)
	return iconNodes
}

/** Every lucide icon name with its search keywords, fetched once as its own chunk. */
export function loadIconTags(): Promise<Record<string, string[]>> {
	iconTags ||= import('lucide-static/tags.json').then(
		(module) => module.default as Record<string, string[]>
	)
	return iconTags
}

/** The icon as an SVG data URI, drawn at the 1.5 stroke frappe-ui's icon classes use. */
export function iconDataUri(node: IconNode): string {
	const children = node
		.map(([tag, attributes]) => {
			const pairs = Object.entries(attributes).map(
				([key, value]) => `${key}="${value}"`
			)
			return `<${tag} ${pairs.join(' ')}/>`
		})
		.join('')
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function iconRule(name: string, uri: string): string {
	const mask = `url("${uri}") center / contain no-repeat`
	return `:where(.lucide-${name}:not(svg)) { display: block; width: 1em; height: 1em; flex-shrink: 0; background-color: currentColor; -webkit-mask: ${mask}; mask: ${mask}; }`
}

function iconSheet(): CSSStyleSheet {
	if (!sheet) {
		const style = document.createElement('style')
		style.dataset.lucideIcons = ''
		document.head.append(style)
		sheet = style.sheet as CSSStyleSheet
	}
	return sheet
}

/**
 * Defines `lucide-<name>` at runtime, as frappe-ui's Tailwind plugin does at
 * build time for the names it finds in source. `:where()` keeps `size-*` winning.
 */
export async function defineIconClass(name: string): Promise<void> {
	if (styled.has(name)) return
	styled.add(name)
	const nodes = await loadIconNodes()
	const uri = iconDataUri(nodes[name] || nodes[FALLBACK_ICON])
	iconSheet().insertRule(iconRule(name, uri), iconSheet().cssRules.length)
}
