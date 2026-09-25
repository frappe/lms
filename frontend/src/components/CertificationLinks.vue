<template>
	<Button
		v-if="certification.data && certification.data.certificate"
		@click="downloadCertificate"
	>
		<template #prefix>
			<span class="lucide-graduation-cap size-4" />
		</template>
		{{ __('View Certificate') }}
	</Button>
	<div
		v-else-if="
			certification.data &&
			certification.data.membership &&
			certification.data.paid_certificate &&
			user.data?.is_student
		"
	>
		<Button
			v-if="!certification.data.membership.purchased_certificate"
			:route="{
				name: 'Billing',
				params: {
					type: 'certificate',
					name: courseName,
				},
			}"
			class="w-full"
		>
			<template #prefix>
				<span class="lucide-graduation-cap size-4" />
			</template>
			{{ __('Get Certified') }}
		</Button>
		<Button
			v-else-if="!certification.data.membership.certificate"
			:route="{
				name: 'CourseCertification',
				params: {
					courseName: courseName,
				},
			}"
			class="w-full"
		>
			<template #prefix>
				<span class="lucide-graduation-cap size-4" />
			</template>
			{{ __('Get Certified') }}
		</Button>
	</div>
</template>
<script setup lang="ts">
import { Button, createResource } from 'frappe-ui'
import { inject } from 'vue'
import type { CertificationInfo, Resource, SessionUser } from '@/types'
import { openExternal } from '@/utils/openExternal'

const user = inject<SessionUser>('$user')!

const props = defineProps<{
	courseName: string
}>()

const certification = createResource({
	url: 'lms.lms.api.get_certification_details',
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: user.data ? true : false,
}) as Resource<CertificationInfo | null>

const downloadCertificate = () => {
	const cert = certification.data?.certificate
	if (!cert) return
	openExternal(
		`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
			cert.name
		}&format=${encodeURIComponent(cert.template)}`
	)
}
</script>
