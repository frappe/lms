<template>
	<div class="mt-7 mb-10">
		<h2 class="mb-3 text-lg-semibold text-ink-gray-9">
			{{ __('Certificates') }}
		</h2>
		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>
		<div
			v-if="isPending"
			class="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3"
			data-testid="certificates-skeleton"
		>
			<ProfileCertificateCardSkeleton v-for="i in 3" :key="i" />
		</div>
		<div
			v-else-if="certificates.data?.length"
			class="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3"
		>
			<a
				v-for="certificate in certificates.data"
				:key="certificate.name"
				:href="certificateUrl(certificate)"
				v-external
				class="flex flex-col bg-surface-base border rounded-6 p-3 cursor-pointer hover:bg-surface-sidebar"
			>
				<div class="font-medium leading-5 mb-2 text-ink-gray-9">
					{{ certificate.course_title || certificate.batch_title }}
				</div>
				<div class="text-sm-medium text-ink-gray-7 mt-auto">
					<span> {{ __('Issued on') }}: </span>
					{{ dayjs(certificate.issue_date).format('DD MMM YYYY') }}
				</div>
			</a>
		</div>
		<div v-else class="text-sm italic text-ink-gray-6">
			{{ __('You have not received any certificates yet.') }}
		</div>
	</div>
</template>
<script setup>
import { createResource } from 'frappe-ui'
import { computed, inject, onMounted } from 'vue'
import ProfileCertificateCardSkeleton from '@/components/Skeletons/ProfileCertificateCardSkeleton.vue'
import { useLoadingAnnouncement } from '@/utils/a11y'

const dayjs = inject('$dayjs')
const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

onMounted(() => {
	if (props.profile.data?.username) {
		certificates.reload()
	}
})

const certificates = createResource({
	url: 'lms.lms.api.get_user_certificates',
	params: {
		username: props.profile.data?.username,
	},
	cache: ['certificates', props.profile.data?.username],
})

const certificateUrl = (certificate) =>
	`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
		certificate.name
	}&format=${encodeURIComponent(certificate.template)}&no_letterhead=1`

const isPending = computed(() => !certificates.data && !certificates.error)

const loadingAnnouncement = useLoadingAnnouncement(
	() => isPending.value,
	() => (certificates.data ? __('Certificates loaded') : '')
)
</script>
