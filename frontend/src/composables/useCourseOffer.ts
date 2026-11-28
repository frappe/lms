import { computed, inject, ref } from 'vue'
import { useSettings } from '@/stores/settings'
import type { CourseFormContext } from '@/types'

export type CertificateKind = 'none' | 'free' | 'paid'

/**
 * What a course sells: its price and its certificate. One owner for the rules,
 * shared by the Overview card and the Settings tab, which edit the same form.
 */
export function useCourseOffer() {
	const { resource, markDirty, isMissing } =
		inject<CourseFormContext>('courseForm')!
	const settingsStore = useSettings()

	/** Opens the Payments app dialog; pricing waits for the app. */
	const needsPaymentsApp = ref<boolean>(false)

	// Blocks only when the app is known to be missing; the server is the hard guard.
	const paymentsAppMissing = computed<boolean>(
		() =>
			Boolean(settingsStore.settings?.data) &&
			!settingsStore.settings.data.is_payments_app_installed
	)

	const certificate = computed<CertificateKind>(() => {
		const doc = resource.doc
		if (doc?.paid_certificate) return 'paid'
		return doc?.enable_certification ? 'free' : 'none'
	})

	function setField(field: string, value: unknown): void {
		if (!resource.doc) return
		;(resource.doc as Record<string, unknown>)[field] = value
		markDirty()
	}

	function setPaidCourse(paid: boolean): void {
		const doc = resource.doc
		if (!doc) return
		if (paid && paymentsAppMissing.value) {
			needsPaymentsApp.value = true
			return
		}
		doc.paid_course = paid ? 1 : 0
		// The paid-certificate flow applies only to free courses.
		if (paid) doc.paid_certificate = 0
		markDirty()
	}

	function setCertificate(kind: CertificateKind): void {
		const doc = resource.doc
		if (!doc) return
		if (kind === 'paid' && paymentsAppMissing.value) {
			needsPaymentsApp.value = true
			return
		}
		doc.enable_certification = kind === 'free' ? 1 : 0
		doc.paid_certificate = kind === 'paid' ? 1 : 0
		markDirty()
	}

	return {
		resource,
		isMissing,
		certificate,
		needsPaymentsApp,
		setField,
		setPaidCourse,
		setCertificate,
	}
}
