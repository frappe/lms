<template>
	<div v-if="badge.data">
		<div class="p-5 flex flex-col items-center mt-40">
			<div class="text-3xl font-semibold">
				{{ badge.data.badge }}
			</div>
			<img
				:src="badge.data.badge_image"
				:alt="badge.data.badge"
				class="h-60 mt-2"
			/>
			<div class="">
				{{
					__('This badge has been awarded to {0} on {1}.').format(
						badge.data.member_name,
						dayjs(badge.data.issued_on).format('DD MMM YYYY')
					)
				}}
			</div>
			<div class="mt-2">
				{{ badge.data.badge_description }}
			</div>
		</div>
	</div>
</template>
<script setup>
import { createDocumentResource, createResource } from 'frappe-ui'
import { computed, inject } from 'vue'

const dayjs = inject('$dayjs')

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

const badge = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return {
			doctype: 'LMS Badge Assignment',
			filters: {
				badge: props.badgeName,
				member: props.email,
			},
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
			label: badge.data.badge,
			route: {
				name: 'Badge',
				params: {
					badge: badge.data.badge,
				},
			},
		},
	]
})
</script>
