import type { App } from 'vue'
import safeHtml from './safeHtml'
import { vExternal } from './external'

export { safeHtml, vExternal }

export function registerDirectives(app: App) {
	app.directive('safe-html', safeHtml)
	app.directive('external', vExternal)
}
