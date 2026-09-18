import './index.css'
import { createApp, watch } from 'vue'
import router from './router'
import App from './App.vue'
import { createPinia } from 'pinia'
import dayjs from '@/utils/dayjs'
import { createDialog } from '@/utils/dialogs'
import translationPlugin from './translation'
import { usersStore } from './stores/user'
import { initSocket } from './socket'
import {
	Button,
	FrappeUI,
	setConfig,
	frappeRequest,
	pageMetaPlugin,
} from 'frappe-ui'
import { telemetryPlugin } from 'frappe-ui/frappe'
import { registerDirectives } from './directives'

let pinia = createPinia()
let app = createApp(App)
setConfig('resourceFetcher', frappeRequest)

app.use(FrappeUI)
// Some legacy Frappe UI components, including ListFooter, resolve Button
// globally instead of importing it locally.
app.component('Button', Button)
app.use(pinia)
app.use(router)
app.use(translationPlugin)
app.use(pageMetaPlugin)
registerDirectives(app)
app.provide('$dayjs', dayjs)
app.provide('$socket', initSocket())

const { userResource, allUsers } = usersStore()
app.provide('$user', userResource)
app.provide('$allUsers', allUsers)

watch(userResource, () => {
	if (userResource.data) {
		app.use(telemetryPlugin, { app_name: 'lms' })
	}
})

app.config.globalProperties.$user = userResource
app.config.globalProperties.$dialog = createDialog

// Wait for the initial route before mounting. Otherwise a cold load of a
// no-sidebar public page briefly mounts DesktopLayout, whose account menu calls
// authenticated-only APIs as Guest and can abort the whole page render.
router.isReady().then(() => app.mount('#app'))
