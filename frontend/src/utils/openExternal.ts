import { safeUrl } from './safeUrl'

// The window.open twin of the v-external directive, and it exists for the same
// reason: the guarantee has to live in one place or a call site will forget it.
//
// 'noopener' severs the window.opener reference the opened page would otherwise
// hold on ours (reverse tabnabbing). It goes in the features string, which does
// not make the result a popup — the HTML spec strips noopener and noreferrer
// from the feature list before deciding whether a popup was requested, so this
// still opens a tab.
//
// The URL clears the same scheme allowlist as every bound href, because
// window.open('javascript:…') runs that script in a document that inherits our
// origin. A rejected URL opens nothing: there is no attribute to remove here, so
// the failure has to be silent, and every call site passes a URL it built or a
// link the author already published.
export const openExternal = (url?: string | null): void => {
	const href = safeUrl(url)
	if (!href) return
	window.open(href, '_blank', 'noopener')
}
