<template>
	<Dialog
		v-model="show"
		:options="{
			size: '5xl',
		}"
	>
		<template #body>
			<div class="p-5 min-h-[300px]">
				<div class="text-lg text-ink-gray-9 font-semibold mb-4">
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
					class="border rounded-lg py-2 px-3"
				>
					<ListHeader
						class="mb-2 grid items-center rounded bg-surface-white border-b rounded-none !px-0"
					>
						<ListHeaderItem :item="item" v-for="item in feedbackColumns">
							<template #prefix="{ item }">
								<FeatherIcon :name="item.icon?.toString()" class="h-4 w-4" />
							</template>
						</ListHeaderItem>
					</ListHeader>
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
												size="xl"
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
	Avatar,
	FeatherIcon,
	ListView,
	ListHeader,
	ListHeaderItem,
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
			align: 'left',
			icon: 'user',
		},
		{
			label: 'Feedback',
			key: 'feedback',
			width: '15rem',
			align: 'left',
			icon: 'message-square',
		},
		{
			label: 'Content',
			key: 'content',
			width: '10rem',
			align: 'center',
			icon: 'book',
		},
		{
			label: 'Instructors',
			key: 'instructors',
			width: '10rem',
			align: 'center',
			icon: 'users',
		},
		{
			label: 'Value',
			key: 'value',
			width: '10rem',
			align: 'center',
			icon: 'dollar-sign',
		},
	]
})
</script>
<style>
.feedback-list > button > div {
	padding: 0.2rem 0;
	margin-bottom: 0.2rem;
}
</style>
