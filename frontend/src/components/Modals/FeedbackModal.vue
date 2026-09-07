<template>
	<Dialog v-model:open="show" size="5xl" bare>
		<template #default>
			<div class="p-5 min-h-[300px]">
				<div class="text-lg-semibold text-ink-gray-9 mb-4">
					{{ __('Training Feedback') }}
				</div>
				<ResponsiveListView
					:columns="feedbackColumns"
					:rows="feedbackList as ListRow[]"
					row-key="name"
					:options="listOptions"
					class="border rounded-lg py-2 px-3"
				>
					<template #cell="{ column, row, value }">
						<div
							v-if="column.key == 'member_name'"
							class="flex items-center gap-3"
						>
							<Avatar
								:image="row.member_image as string"
								:label="value as string"
								size="xl"
							/>
							<span class="truncate">{{ value }}</span>
						</div>
						<Rating
							v-else-if="ratingKeys.includes(column.key)"
							:modelValue="Number(value)"
							:disabled="true"
						/>
						<div v-else class="text-sm leading-5">{{ value }}</div>
					</template>
				</ResponsiveListView>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog, Avatar, Rating } from 'frappe-ui'
import { computed } from 'vue'
import type { ListRow, ListViewOptions } from '@/types'
import ResponsiveListView from '@/components/ResponsiveListView.vue'

const show = defineModel()
const ratingKeys = ['content', 'instructors', 'value']

const listOptions = {
	showTooltip: false,
	rowHeight: 'h-16',
	selectable: false,
} as ListViewOptions

const props = defineProps({
	feedbackList: {
		type: Array,
		required: true,
	},
})

const feedbackColumns = computed(() => {
	return [
		{
			label: 'Member',
			key: 'member_name',
			width: '10rem',
			align: 'left',
			icon: 'lucide-user',
		},
		{
			label: 'Feedback',
			key: 'feedback',
			width: '15rem',
			align: 'left',
			icon: 'lucide-message-square',
		},
		{
			label: 'Content',
			key: 'content',
			width: '10rem',
			align: 'left',
			icon: 'lucide-book',
		},
		{
			label: 'Instructors',
			key: 'instructors',
			width: '10rem',
			align: 'left',
			icon: 'lucide-users',
		},
		{
			label: 'Value',
			key: 'value',
			width: '10rem',
			align: 'left',
			icon: 'lucide-dollar-sign',
		},
	]
})
</script>
