<template>
	<div v-if="badge.doc">
		<div class="p-5 flex flex-col items-center mt-40">
			<div class="text-3xl font-semibold">
				{{ badge.doc.badge }}
			</div>
			<img
				:src="badge.doc.badge_image"
				:alt="badge.doc.badge"
				class="h-60 mt-2"
			/>
			<div class="text-lg">
				{{
					__('This badge has been awarded to {0} on {1}.').format(
						badge.doc.member_name,
						dayjs(badge.doc.issued_on).format('DD MMM YYYY')
					)
				}}
			</div>
			<div class="text-lg mt-2">
				{{ badge.doc.badge_description }}
			</div>
		</div>
	</div>
</template>
<script setup>
import { createDocumentResource } from 'frappe-ui'
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

const badge = createDocumentResource({
	doctype: 'LMS Badge Assignment',
	filters: {
		badge: props.badgeName,
		member: props.email,
	},
})

const breadcrumbs = computed(() => {
	return [
		{
			label: 'Badges',
		},
		{
			label: badge.doc.badge,
			route: {
				name: 'Badge',
				params: {
					badge: badge.doc.badge,
				},
			},
		},
	]
})
</script>
