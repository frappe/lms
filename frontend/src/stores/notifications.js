import {
	createListResource,
	createResource,
	getCachedResource,
} from 'frappe-ui'
import { ref } from 'vue'

// Slide-over panel visibility (module-level singleton, CRM pattern). Both the
// sidebar trigger and the panel import this directly.
export const panelVisible = ref(false)

export function toggleNotifications() {
	panelVisible.value = !panelVisible.value
}

export function openNotifications() {
	panelVisible.value = true
}

export function closeNotifications() {
	panelVisible.value = false
}

// One list of ALL notifications (read + unread), like CRM. Unread state is
// shown per-row with a dot. Fetched on panel open.
export const notifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {},
	auto: false,
	cache: 'LMS Notifications',
})

const refreshSidebarCount = () => {
	getCachedResource('Unread Notifications Count')?.reload()
}

export const markAsRead = createResource({
	url: 'frappe.desk.doctype.notification_log.notification_log.mark_as_read',
	makeParams(values) {
		return { docname: values.name }
	},
	onSuccess() {
		notifications.reload()
		refreshSidebarCount()
	},
})

export const markAllAsRead = createResource({
	url: 'frappe.desk.doctype.notification_log.notification_log.mark_all_as_read',
	onSuccess() {
		notifications.reload()
		refreshSidebarCount()
	},
})
