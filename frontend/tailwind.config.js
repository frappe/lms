import frappeUIPreset from 'frappe-ui/tailwind'
import { safeAreaPlugin } from './tailwind/safeArea.js'

// App code imports `@framework/ui` by name, through the package's `exports`.
// Tailwind cannot: `content` takes globs over files, not module specifiers, and it
// generates only the classes it finds there. Without the framework's source in this
// list every class used *only* inside a `@framework/ui` component is missing from
// this app's CSS, invisibly and selectively — the ones app code also uses somewhere
// are generated anyway. `lucide-group` and `lucide-ungroup` in ConditionBuilder's
// row menu rendered as empty spans, being the only two icons nothing else in LMS
// uses.
//
// Literal globs, the way helpdesk writes them (`desk/tailwind.config.js`). A glob
// matching nothing is ignored, so both depths are listed rather than resolved: the
// first is this app checked out at `apps/lms/frontend`, the second a git worktree of
// it under `apps/lms/.lms-worktrees/<name>/frontend`, which is two levels deeper.
export default {
	presets: [frappeUIPreset],
	content: [
		'./index.html',
		'./src/**/*.{vue,js,ts,jsx,tsx}',
		'../../frappe/ui/src/**/*.{vue,js,ts,jsx,tsx}',
		'../../../../frappe/ui/src/**/*.{vue,js,ts,jsx,tsx}',
		'./node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}',
		'../node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}',
		'./node_modules/frappe-ui/frappe/**/*.{vue,js,ts,jsx,tsx}',
		'../node_modules/frappe-ui/frappe/**/*.{vue,js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			strokeWidth: {
				1.5: '1.5',
			},
			screens: {
				'2xl': '1600px',
				'3xl': '1920px',
			},
		},
	},
	plugins: [safeAreaPlugin],
}
