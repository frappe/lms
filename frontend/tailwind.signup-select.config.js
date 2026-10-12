import frappeUIPreset from 'frappe-ui/tailwind'
import path from 'node:path'

const frappeUiSrc = path.resolve(__dirname, 'node_modules/frappe-ui/src')

export default {
	presets: [frappeUIPreset],
	content: [
		'./src/signup-select.js',
		path.join(frappeUiSrc, 'components/Select/**/*.{vue,ts}'),
		path.join(frappeUiSrc, 'components/ItemListRow/**/*.{vue,ts}'),
		path.join(frappeUiSrc, 'components/InputLabeling/**/*.{vue,ts}'),
		path.join(frappeUiSrc, 'components/shared/popover/**/*.{vue,ts}'),
		path.join(frappeUiSrc, 'components/shared/selection/**/*.{vue,ts}'),
		path.join(frappeUiSrc, 'utils/**/*.{js,ts}'),
	],
}
