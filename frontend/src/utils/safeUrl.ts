// Scheme allowlist for any URL that reaches a bound src/href attribute.
// DOMPurify never sees attribute bindings, so a javascript: URL in an iframe
// :src executes in the app's own origin. Control characters and whitespace are
// stripped first because the browser ignores them when resolving the scheme.
//
// Rejection returns undefined, not '', because Vue removes an attribute only
// when the bound value is null or undefined (runtime-dom patchAttr) — an empty
// string is set. src="" resolves to the current page, so an iframe would
// render the whole SPA inside itself, and <a href=""> would stay focusable and
// navigate nowhere. Removing the attribute is the accessible failure.
// The site-relative branch rejects a second slash *and* a backslash: the URL
// parser normalises `\` to `/` for http(s), so `/\host/p` is `//host/p` — an
// off-origin URL that reads as a path. Both spellings have to fail here for the
// allowlist to mean what its name says.
const ALLOWED = /^(https?:|\/(?![/\\])|#|mailto:)/i
const IGNORED_BY_BROWSER = /[\u0000-\u0020]/g

export const safeUrl = (value?: string | null): string | undefined => {
	if (!value) return undefined
	return ALLOWED.test(value.replace(IGNORED_BY_BROWSER, '')) ? value : undefined
}
