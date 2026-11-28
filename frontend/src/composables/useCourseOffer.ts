import { computed, inject } from 'vue'
import { usePaymentsApp } from '@/composables/usePaymentsApp'
import type { CourseFormContext } from '@/types'
import type { LMSCourse } from '@/types/lms/LMSCourse'

export type CertificateKind = 'none' | 'free' | 'paid'

/**
 * What a course sells: its price and its certificate. One owner for the rules,
 * shared by the Overview card and the Settings tab, which edit the same form.
 */
export function useCourseOffer() {
	const { resource, markDirty, isMissing } =
		inject<CourseFormContext>('courseForm')!
	const { needsPaymentsApp, canSell } = usePaymentsApp()

	const certificate = computed<CertificateKind>(() => {
		const doc = resource.doc
		if (doc?.paid_certificate) return 'paid'
		return doc?.enable_certification ? 'free' : 'none'
	})

	function setField(field: keyof LMSCourse, value: unknown): void {
		if (!resource.doc) return
		;(resource.doc as Record<string, unknown>)[field] = value
		markDirty()
	}

	function setPaidCourse(paid: boolean): void {
		const doc = resource.doc
		if (!doc) return
		if (paid && !canSell()) return
		doc.paid_course = paid ? 1 : 0
		// The paid-certificate flow applies only to free courses.
		if (paid) doc.paid_certificate = 0
		markDirty()
	}

	function setCertificate(kind: CertificateKind): void {
		const doc = resource.doc
		if (!doc) return
		if (kind === 'paid' && !canSell()) return
		doc.enable_certification = kind === 'free' ? 1 : 0
		doc.paid_certificate = kind === 'paid' ? 1 : 0
		markDirty()
	}

	return {
		resource,
		markDirty,
		isMissing,
		certificate,
		needsPaymentsApp,
		setField,
		setPaidCourse,
		setCertificate,
	}
}
