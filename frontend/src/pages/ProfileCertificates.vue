<template>
	<div class="mt-7 mb-10">
		<h2 class="mb-3 text-lg font-semibold text-ink-gray-9">
			{{ __('Certificates') }}
		</h2>
		<div
			v-if="certificates.data?.length"
			class="grid grid-cols-1 md:grid-cols-2 gap-4"
		>
			<div
				v-for="certificate in certificates.data"
				:key="certificate.name"
				class="flex flex-row items-center justify-center gap-4 bg-white border rounded-lg p-3 cursor-pointer hover:bg-primary-50 hover:border-primary-500"
				@click="openCertificate(certificate)"
			>
			<div class="bg-warning-50 w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0">
				<Award2Icon class="text-warning-500 w-8 h-8"/>
			</div>
				<div class="flex-1">
					<div class="text-xl font-semibold leading-5 mb-1 text-gray-900 leading-6">
					{{ certificate.course_title || certificate.batch_title }}
				</div>
				<div class="text-sm text-gray-700 font-regular mt-auto">
					<span> {{ __('Issued on') }}: </span>
					{{ dayjs(certificate.issue_date).format('DD MMM YYYY') }}
				</div>
				</div>
			</div>
		</div>
		<div v-else class="text-sm italic text-ink-gray-5">
			{{ __('You have not received any certificates yet.') }}
		</div>
	</div>
</template>
<script setup>
import { createListResource } from 'frappe-ui'
import { inject, onMounted } from 'vue'
import Award2Icon from '@/components/Icons/Award2Icon.vue'

const dayjs = inject('$dayjs')
const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

onMounted(() => {
	if (props.profile.data?.name) {
		certificates.reload()
	}
})

const certificates = createListResource({
	doctype: 'LMS Certificate',
	filters: {
		member: props.profile.data?.name,
	},
	fields: ['name', 'course_title', 'batch_title', 'issue_date', 'template'],
	cache: ['certificates', props.profile.data?.name],
})

const openCertificate = (certificate) => {
	window.open(
		`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
			certificate.name
		}&format=${encodeURIComponent(certificate.template)}`
	)
}
</script>
