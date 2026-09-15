import { createListResource, createResource } from 'frappe-ui'
import { ref } from 'vue'
import { sessionStore } from '@/stores/session'

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

// How many are unread, for whoever wants to show it: the desk sidebar's badge
// and the You page's Notifications row.
//
// This used to be a component-local ref inside AppSidebar, fed by a resource
// carrying `cache: 'Unread Notifications Count'` — the exact shape that caused
// bbf030fc5 and 1298a0dae. createResource returns the FIRST instance for a
// cache key and never rebinds its onSuccess, so a remounted sidebar's ref would
// stay at zero forever while the cached resource kept writing into the
// unmounted one. It also meant the count only existed if AppSidebar had been
// mounted, which on a phone it never is: `markAsRead` reached for the cached
// resource by name and quietly found nothing.
//
// Module-level state has neither problem. Nothing here closes over a component.
export const unreadCount = ref(0)

export const unreadNotifications = createResource({
	url: 'frappe.client.get_count',
	makeParams() {
		return {
			doctype: 'Notification Log',
			filters: { for_user: sessionStore().user, read: 0 },
		}
	},
	onSuccess(data) {
		unreadCount.value = data || 0
	},
	auto: false,
})

/** No-op for a signed-out visitor, who has no notifications to count. */
export function loadUnreadCount() {
	if (!sessionStore().user) return
	return unreadNotifications.reload()
}

const refreshSidebarCount = () => {
	if (sessionStore().user) unreadNotifications.reload()
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
