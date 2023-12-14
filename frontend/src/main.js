import './index.css'

import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import { createPinia } from 'pinia'
import dayjs from '@/utils/dayjs'
import translationPlugin from './translation'
import { usersStore } from './stores/user'
import { sessionStore } from './stores/session'

import { FrappeUI, setConfig, frappeRequest, resourcesPlugin } from 'frappe-ui'

let pinia = createPinia()
let app = createApp(App)
setConfig('resourceFetcher', frappeRequest)

app.use(FrappeUI)
app.use(pinia)
app.use(router)
app.use(resourcesPlugin)
app.use(translationPlugin)
app.provide('$dayjs', dayjs)

app.mount('#app')

const { userResource } = usersStore()
let { isLoggedIn } = sessionStore()

if (isLoggedIn) {
	await userResource.reload()
}

app.provide('$user', userResource)
app.config.globalProperties.$user = userResource