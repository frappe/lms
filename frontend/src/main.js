import './index.css'
import translationPlugin, { loadTranslations } from './translation'
import { createApp, watch } from 'vue'
import router from './router'
import App from './App.vue'
import { createPinia } from 'pinia'
import dayjs from '@/utils/dayjs'
import { createDialog } from '@/utils/dialogs'
import { usersStore } from './stores/user'
import { initSocket } from './socket'
import { FrappeUI, setConfig, frappeRequest } from 'frappe-ui'
import { telemetryPlugin } from '@framework/ui/telemetry/index'
import { registerDirectives } from './directives'
import { dedupeToasts } from '@/utils/toastDedupe'
import { keepFlowUsableBesideDialogs } from '@/utils/flowBesideDialogs'
import { routeFlowLinks } from '@/utils/flowLinks'
import { followFlowChanges } from '@/utils/followFlow'
import { canEditPrograms } from '@/utils/recordRoutes'

let pinia = createPinia()
let app = createApp(App)
setConfig('resourceFetcher', frappeRequest)
dedupeToasts()
keepFlowUsableBesideDialogs()
setConfig('maxFileSize', window.max_file_size)

app.use(FrappeUI)
app.use(pinia)
app.use(router)
app.use(translationPlugin)
registerDirectives(app)
app.provide('$dayjs', dayjs)
const socket = initSocket()
app.provide('$socket', socket)

const { userResource, allUsers } = usersStore()
app.provide('$user', userResource)
app.provide('$allUsers', allUsers)
const recordRouteContext = () => ({
	canEditPrograms: canEditPrograms(userResource.data),
})
routeFlowLinks(router, recordRouteContext)
followFlowChanges(router, socket, recordRouteContext)

watch(userResource, () => {
	if (userResource.data) {
		// The router lets the plugin record each page a new site's admins and
		// learners visit (only for sites under 15 days old).
		app.use(telemetryPlugin, { app_name: 'lms', router })
	}
})

app.config.globalProperties.$user = userResource
app.config.globalProperties.$dialog = createDialog

loadTranslations().finally(() => app.mount('#app'))
