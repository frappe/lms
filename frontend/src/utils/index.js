import { toast } from 'frappe-ui'
import { useDateFormat, useTimeAgo } from '@vueuse/core'

export function createToast(options) {
	toast({
		position: 'bottom-right',
		...options,
	})
}

export function timeAgo(date) {
	return useTimeAgo(date).value
}
