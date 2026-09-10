// The one way out of settings and into Raven, as an entry both detail pages put
// in their header menu. It opens a tab rather than navigating, so the unsaved
// draft the page may be holding survives, either page can be sitting on a draft
// with a Not Saved badge, and a same-tab jump would discard it.
//
// The entry is built here rather than in each page because the two menus have to
// say the same thing: this was a shared component until the pages moved it into
// their "..." menu, where a frappe-ui row is an option object, not a component.
import { openExternal } from '@/utils/openExternal'
import { ravenChannelUrl, ravenWorkspaceUrl } from './ravenUrl'
import type { DropdownOption } from '@/composables/raven/useMappingList'

export interface RavenTarget {
	/** The Raven workspace id. Absent on a mapping that was never adopted. */
	ravenWorkspace?: string | null
	/** The Raven channel id; leave it out entirely to address the workspace. */
	ravenChannel?: string | null
	/** The linked Raven record is gone, so there is nothing to open. */
	stale?: boolean
}

/** Empty when there is nothing to open, which is the caller's cue to offer nothing. */
export function ravenHref(target: RavenTarget): string {
	if (target.stale || !target.ravenWorkspace) return ''
	if (target.ravenChannel === undefined)
		return ravenWorkspaceUrl(target.ravenWorkspace)
	// An explicit null channel means "a channel was intended but is not there".
	if (!target.ravenChannel) return ''
	return ravenChannelUrl(target.ravenWorkspace, target.ravenChannel)
}

/**
 * The entry as a menu takes it, or nothing at all: a mapping with no Raven record
 * yet, or one whose record was deleted, would land on Raven's own 404. The stale
 * case already has Recreate on its list row, which is the useful action there.
 */
export function openInRavenOptions(target: RavenTarget): DropdownOption[] {
	const href = ravenHref(target)
	if (!href) return []
	return [
		{
			label: __('Open in Raven'),
			icon: 'lucide-external-link',
			// Through the helper, which is the app's only window.open: it passes
			// `noopener` so the opened page cannot reach back through
			// `window.opener`, and clears the href against the same scheme
			// allowlist every bound attribute uses.
			onClick: () => openExternal(href),
		},
	]
}
