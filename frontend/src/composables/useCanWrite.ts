import { call } from 'frappe-ui'
import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

// Asks frappe.client.has_permission for "write": get_doc_permissions (CRM's
// data/document.js) runs the hook with no ptype, so misses author-only writes.
// null until the server answers; a document with no name yet is writable.
export function useCanWrite(
	doctype: string,
	name: MaybeRefOrGetter<string | undefined>
): Ref<boolean | null> {
	const canWrite = ref<boolean | null>(null)
	let latest = 0

	watch(
		() => toValue(name),
		async (docname) => {
			const asked = ++latest
			if (!docname) {
				canWrite.value = true
				return
			}
			canWrite.value = null
			let allowed = false
			try {
				const answer: { has_permission?: boolean } | undefined = await call(
					'frappe.client.has_permission',
					{ doctype, docname, perm_type: 'write' }
				)
				allowed = Boolean(answer?.has_permission)
			} catch {
				allowed = false
			}
			if (asked === latest) canWrite.value = allowed
		},
		{ immediate: true }
	)

	return canWrite
}
