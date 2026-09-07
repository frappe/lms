import { config } from '@vue/test-utils'
import { safeHtml, vExternal } from '../directives'

// main.js registers these on the app, so a component that uses one renders
// wrong under a bare mount() and the failure looks like missing data rather
// than a missing directive. Registering them here keeps component tests
// rendering what the app renders.
config.global.directives = {
	...config.global.directives,
	'safe-html': safeHtml,
	external: vExternal,
}
