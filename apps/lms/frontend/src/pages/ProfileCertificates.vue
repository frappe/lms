<template>
	<div class="mt-7 mb-10">
		<h2 class="mb-3 text-lg font-semibold text-ink-gray-9">
			{{ __('Certificates') }}
		</h2>
		<div class="grid grod-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<div
				v-for="certificate in certificates.data"
				:key="certificate.name"
				class="flex flex-col bg-surface-white border rounded-lg p-3 cursor-pointer hover:bg-surface-menu-bar"
				@click="openCertificate(certificate)"
			>
				<div class="font-medium leading-5 mb-2 text-ink-gray-9">
					{{ certificate.course_title || certificate.batch_title }}
				</div>
				<div class="text-sm text-ink-gray-7 font-medium mt-auto">
					<span> {{ __('Issued on') }}: </span>
					{{ dayjs(certificate.issue_date).format('DD MMM YYYY') }}
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { createListResource } from 'frappe-ui'
import { inject, onMounted } from 'vue'

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
