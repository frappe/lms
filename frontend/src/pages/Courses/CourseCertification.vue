<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<PageBody :title="__('Certification')">
		<div class="px-5 pb-5">
			<div v-if="certificate">
				<div class="text-ink-gray-9 text-sm">
					{{
						__(
							'You are already certified for this course. Click on the card below to open your certificate.'
						)
					}}
				</div>
				<button
					type="button"
					class="border p-3 w-fit min-w-60 rounded-md space-y-2 hover:bg-surface-gray-1 cursor-pointer mt-5 text-start block"
					@click="openCertificate"
				>
					<div class="text-ink-gray-9 font-semibold">
						{{ courseTitle }}
					</div>
					<div class="text-sm-medium text-ink-gray-7">
						{{ __('Issued On') }}:
						{{ dayjs(certificate.issue_date).format('DD MMM YYYY') }}
					</div>
				</button>
			</div>
			<div v-else>
				<UpcomingEvaluations v-if="courses.length" :courses="courses" />
			</div>
		</div>
	</PageBody>
</template>
<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import PageBody from '@/components/Layouts/pages/PageBody.vue'
import { createResource, toast, usePageMeta } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { sessionStore } from '../../stores/session'
import UpcomingEvaluations from '@/components/UpcomingEvaluations.vue'
import { openExternal } from '@/utils/openExternal'
import { resourceErrorMessage } from '@/utils/resource'
import type dayjsType from 'dayjs'
import type { CertificationInfo, Resource, SessionUser } from '@/types'

const { brand } = sessionStore()
const user = inject<SessionUser>('$user')!
const dayjs = inject<typeof dayjsType>('$dayjs')!
const router = useRouter()

const props = defineProps<{ courseName: string }>()

/* One call for the title, the evaluator, the enrollment and the certificate:
   LMS Student cannot read LMS Course, so fetching the title and evaluator
   through frappe.client.get_value 403s for the learner this page is for. */
const certification = createResource({
	url: 'lms.lms.api.get_certification_details',
	makeParams() {
		return { course: props.courseName }
	},
	auto: false,
	onSuccess(data: CertificationInfo | null) {
		if (!data?.membership?.purchased_certificate) {
			router.push({
				name: 'CourseDetail',
				params: { courseName: props.courseName },
			})
		}
	},
	onError(error: unknown) {
		toast.error(
			resourceErrorMessage(error, __('Could not load this certification.'))
		)
	},
}) as Resource<CertificationInfo | null>

/* auto: user.data ? true : false evaluates once, at setup, so a load reaching
   here before userResource resolves locked auto false forever. Fetch once
   user.data arrives; a guest whose data never arrives never fires this route. */
if (user.data) {
	certification.fetch()
} else {
	const stopUserWatch = watch(
		() => user.data,
		(data) => {
			if (data) {
				certification.fetch()
				stopUserWatch()
			}
		}
	)
}

const certificate = computed(() => certification.data?.certificate)
const courseTitle = computed(() => certification.data?.title)

/* UpcomingEvaluations takes the batch shape, where each row carries its own
   evaluator. A course evaluated on its own is a list of one. */
const courses = computed(() => {
	const details = certification.data
	if (!details?.title) return []
	return [
		{
			course: props.courseName,
			title: details.title,
			evaluator: details.evaluator,
		},
	]
})

const openCertificate = () => {
	const cert = certificate.value
	if (!cert) return
	openExternal(
		`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
			cert.name
		}&format=${encodeURIComponent(cert.template)}`
	)
}

const breadcrumbs = computed(() => [
	{
		label: __('Courses'),
		route: { name: 'Courses' },
	},
	{
		label: courseTitle.value ?? '',
		route: { name: 'CourseDetail', params: { courseName: props.courseName } },
	},
	{
		label: __('Certification'),
	},
])

usePageMeta(() => {
	return {
		title: courseTitle.value ?? '',
		icon: brand.favicon,
	}
})
</script>
