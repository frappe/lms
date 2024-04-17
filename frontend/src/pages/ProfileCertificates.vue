<template>
	<div class="mt-7">
		<h2 class="mb-3 text-lg font-semibold text-gray-900">
			{{ __('Certificates') }}
		</h2>
		<div class="grid grid-cols-3 gap-4">
			<div
				v-for="certificate in certificates.data"
				:key="certificate.name"
				class="bg-white shadow rounded-lg p-3 cursor-pointer"
				@click="openCertificate(certificate)"
			>
				<div class="font-medium leading-5">
					{{ certificate.course_title }}
				</div>
				<div class="mt-2">
					<span class="text-xs text-gray-700"> {{ __('issued on') }}: </span>
					{{ dayjs(certificate.issue_date).format('DD MMM YYYY') }}
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { createResource } from 'frappe-ui'
import { inject } from 'vue'

const dayjs = inject('$dayjs')
const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

const certificates = createResource({
	url: 'frappe.client.get_list',
	params: {
		doctype: 'LMS Certificate',
		fields: ['name', 'course', 'course_title', 'issue_date', 'template'],
		filters: {
			member: props.profile.data.name,
		},
	},
	auto: true,
})

const openCertificate = (certificate) => {
	window.open(
		`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
			certificate.name
		}&format=${encodeURIComponent(certificate.template)}`
	)
}
</script>
