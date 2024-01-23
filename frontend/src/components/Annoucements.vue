<template>
	<div v-if="communications.data?.length">
		<div v-for="comm in communications.data">
			<div class="mb-8">
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center">
						<Avatar :label="comm.sender_full_name" size="lg" />
						<div class="ml-2">
							{{ comm.sender_full_name }}
						</div>
					</div>
					<div class="text-sm">
						{{ timeAgo(comm.communication_date) }}
					</div>
				</div>
				<div
					class="prose prose-sm bg-gray-50 !min-w-full px-4 py-2 rounded-md"
					v-html="comm.content"
				></div>
			</div>
		</div>
	</div>
	<div v-else class="text-sm italic text-gray-600">
		{{ __('No announcements') }}
	</div>
</template>
<script setup>
import { createListResource, Avatar } from 'frappe-ui'
import { timeAgo } from '@/utils'

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

const communications = createListResource({
	doctype: 'Communication',
	fields: [
		'subject',
		'content',
		'recipients',
		'cc',
		'communication_date',
		'sender',
		'sender_full_name',
	],
	filters: {
		reference_doctype: 'LMS Batch',
		reference_name: props.batch,
	},
	orderBy: 'communication_date desc',
	auto: true,
	cache: ['batch', props.batch],
})
</script>
<style>
.prose-sm p {
	margin: 0 0 0.5rem;
}
</style>
