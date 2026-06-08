<template>
	<Button
		v-if="certification.data && certification.data.certificate"
		@click="downloadCertificate"
		class=""
	>
		<template #prefix>
			<GraduationCap class="size-4 stroke-1.5" />
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
		<router-link
			v-if="!certification.data.membership.purchased_certificate"
			:to="{
				name: 'Billing',
				params: {
					type: 'certificate',
					name: courseName,
				},
			}"
		>
			<Button class="w-full">
				<template #prefix>
					<GraduationCap class="size-4 stroke-1.5" />
				</template>
				{{ __('Get Certified') }}
			</Button>
		</router-link>
		<router-link
			v-else-if="!certification.data.membership.certificate"
			:to="{
				name: 'CourseCertification',
				params: {
					courseName: courseName,
				},
			}"
		>
			<Button class="w-full">
				<template #prefix>
					<GraduationCap class="size-4 stroke-1.5" />
				</template>
				{{ __('Get Certified') }}
			</Button>
		</router-link>
	</div>
</template>
<script setup lang="ts">
import { Button, createResource } from 'frappe-ui'
import { inject } from 'vue'
import { GraduationCap } from 'lucide-vue-next'
import type { CertificationInfo, Resource, SessionUser } from '@/types/api'

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
	window.open(
		`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
			cert.name
		}&format=${encodeURIComponent(cert.template)}`
	)
}
</script>
