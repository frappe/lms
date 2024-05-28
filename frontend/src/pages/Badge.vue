<template>
	<div v-if="badge.doc">
		<div class="p-5 flex flex-col items-center mt-40">
			<div class="text-3xl font-semibold">
				{{ badge.doc.title }}
			</div>
			<img :src="badge.doc.image" :alt="badge.doc.title" class="h-60 mt-2" />
			<div class="text-lg">
				{{
					__('This badge has been awarded to {0} on {1}.').format(
						userName,
						dayjs(issuedOn.data?.issued_on).format('DD MMM YYYY')
					)
				}}
			</div>
			<div class="text-lg mt-2">
				{{ badge.doc.description }}
			</div>
		</div>
	</div>
</template>
<script setup>
import { createDocumentResource, createResource, Breadcrumbs } from 'frappe-ui'
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'

const allUsers = inject('$allUsers')
const dayjs = inject('$dayjs')
const router = useRouter()

const props = defineProps({
	badgeName: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
	},
})

const badge = createDocumentResource({
	doctype: 'LMS Badge',
	name: props.badgeName,
})

const userName = computed(() => {
	const user = Object.values(allUsers.data).find(
		(user) => user.name === props.email
	)
	return user ? user.full_name : props.email
})

const issuedOn = createResource({
	url: 'frappe.client.get_value',
	makeParams(values) {
		return {
			doctype: 'LMS Badge Assignment',
			filters: {
				member: props.email,
				badge: props.badgeName,
			},
			fieldname: 'issued_on',
		}
	},
	onSuccess(data) {
		if (!data.issued_on) {
			router.push({ name: 'Courses' })
		}
	},
	auto: true,
})

const breadcrumbs = computed(() => {
	return [
		{
			label: 'Badges',
		},
		{
			label: badge.doc.title,
			route: {
				name: 'Badge',
				params: {
					badge: badge.doc.name,
				},
			},
		},
	]
})
</script>
