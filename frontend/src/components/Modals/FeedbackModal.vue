<template>
	<Dialog
		v-model="show"
		:options="{
			size: '4xl',
		}"
	>
		<template #body>
			<div class="p-5 min-h-[300px]">
				<div class="text-lg font-semibold mb-4">
					{{ __('Training Feedback') }}
				</div>
				<ListView
					:columns="feedbackColumns"
					:rows="feedbackList"
					row-key="name"
					:options="{
						showTooltip: false,
						rowHeight: 'h-16',
						selectable: false,
					}"
				>
					<ListHeader
						class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
					></ListHeader>
					<ListRows>
						<ListRow
							:row="row"
							v-for="row in feedbackList"
							class="group feedback-list"
						>
							<template #default="{ column, item }">
								<ListRowItem
									:item="row[column.key]"
									:align="column.align"
									class="text-sm"
								>
									<template #prefix>
										<div v-if="column.key == 'member_name'">
											<Avatar
												class="flex"
												:image="row['member_image']"
												:label="item"
												size="sm"
											/>
										</div>
									</template>
									<div v-if="ratingKeys.includes(column.key)">
										<Rating v-model="row[column.key]" :readonly="true" />
									</div>
									<div v-else class="leading-5">
										{{ row[column.key] }}
									</div>
								</ListRowItem>
							</template>
						</ListRow>
					</ListRows>
				</ListView>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Dialog,
	ListView,
	Avatar,
	ListHeader,
	ListRows,
	ListRow,
	ListRowItem,
	Rating,
} from 'frappe-ui'
import { reactive, computed } from 'vue'

const show = defineModel()
const ratingKeys = ['content', 'instructors', 'value']

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
		},
		{
			label: 'Feedback',
			key: 'feedback',
			width: '15rem',
		},
		{
			label: 'Content',
			key: 'content',
			width: '9rem',
		},
		{
			label: 'Instructors',
			key: 'instructors',
			width: '9rem',
		},
		{
			label: 'Value',
			key: 'value',
			width: '9rem',
		},
	]
})
</script>
