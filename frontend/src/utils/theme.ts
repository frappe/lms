import { ref } from 'vue'

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

// Two keys, deliberately.
//
// `themePreference` holds what the user chose, including 'system'. `theme`
// holds the RESOLVED light/dark value, which index.html's pre-paint bootstrap
// reads as the legacy fallback for an install that predates the preference key.
// Nothing renders from it any more: the code editor used to read it directly to
// pick an Ace theme, and now follows the app's tokens under [data-theme].
const PREFERENCE_KEY = 'themePreference'
const RESOLVED_KEY = 'theme'

const prefersDark = (): boolean =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-color-scheme: dark)').matches

const storedPreference = (): ThemePreference => {
	const stored = localStorage.getItem(PREFERENCE_KEY)
	if (stored === 'light' || stored === 'dark' || stored === 'system') {
		return stored
	}
	// No preference key yet: inherit whatever the old single-key setup resolved
	// to, so an existing user's choice survives the upgrade rather than snapping
	// to system on first load after deploy.
	const legacy = localStorage.getItem(RESOLVED_KEY)
	return legacy === 'dark' || legacy === 'light' ? legacy : 'system'
}

const resolve = (preference: ThemePreference): Theme =>
	preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference

const themePreference = ref<ThemePreference>(storedPreference())
const theme = ref<Theme>(resolve(themePreference.value))

const paint = (resolved: Theme): void => {
	document.documentElement.setAttribute('data-theme', resolved)
	localStorage.setItem(RESOLVED_KEY, resolved)
	theme.value = resolved
}

const setThemePreference = (preference: ThemePreference): void => {
	themePreference.value = preference
	localStorage.setItem(PREFERENCE_KEY, preference)
	paint(resolve(preference))
}

// Paint at module init rather than from a component's onMounted. The previous
// arrangement had UserDropdown call applyTheme(theme.value) on mount, which
// under a tri-state preference would rewrite a 'system' choice into a concrete
// light/dark on every load. Painting here also removes the flash of the wrong
// theme between first paint and that component mounting.
if (typeof document !== 'undefined') {
	// paint(), not a bare setAttribute: `theme` is the resolved key index.html
	// falls back to, and on a load where the user never touches the theme control
	// nothing else writes it.
	paint(theme.value)
	// Writing the resolved key needs the preference written beside it. Otherwise
	// storedPreference()'s legacy fallback reads that value back on the next load
	// as a concrete choice, pinning a 'system' user to whatever their OS happened
	// to be at first paint. The fallback only has to serve the upgrade from the
	// old single-key setup, and it already ran above.
	localStorage.setItem(PREFERENCE_KEY, themePreference.value)
}

// While the preference is 'system', follow the OS live rather than only at
// load. Registered once at module scope; there is exactly one theme.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
	window
		.matchMedia('(prefers-color-scheme: dark)')
		.addEventListener('change', () => {
			if (themePreference.value === 'system') paint(resolve('system'))
		})
}

export { setThemePreference, theme, themePreference }
