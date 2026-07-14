<template>
	<template v-if="view === 'list'">
		<SettingsLayout :title="label" :description="__(description)">
			<template #header-actions>
				<Button variant="solid" @click="openForm('new')">
					<template #prefix>
						<span class="lucide-plus h-4 w-4" />
					</template>
					{{ __('New') }}
				</Button>
			</template>
			<List v-if="badges.data?.length" :columns="columns" class="list-row-px-3">
				<ListHeader>
					<ListHeaderCell>{{ __('Badge') }}</ListHeaderCell>
					<ListHeaderCell>{{ __('Awarded For') }}</ListHeaderCell>
					<ListHeaderCell>{{ __('Grant') }}</ListHeaderCell>
					<ListHeaderCell>{{ __('Status') }}</ListHeaderCell>
					<ListHeaderCell />
				</ListHeader>
				<ListRows :items="badges.data" row-key="name" v-slot="{ item: row }">
					<ListRow class="py-3" @click="openForm(row.name)">
						<ListCell class="gap-2">
							<span class="lucide-award size-4 shrink-0 text-ink-gray-5" />
							<span class="truncate text-p-base-medium text-ink-gray-8">
								{{ row.title }}
							</span>
						</ListCell>
						<ListCell class="text-p-base text-ink-gray-6">
							<span class="truncate">
								{{
									doctypeLabel[
										row.reference_doctype as keyof typeof doctypeLabel
									] || row.reference_doctype
								}}
							</span>
						</ListCell>
						<ListCell class="text-p-base text-ink-gray-6">
							<span class="truncate">
								{{ row.grant_only_once ? __('Once') : __('Every time') }}
							</span>
						</ListCell>
						<ListCell>
							<Badge :theme="row.enabled ? 'green' : 'gray'">
								{{ row.enabled ? __('Enabled') : __('Disabled') }}
							</Badge>
						</ListCell>
						<ListCell class="justify-end" @click.stop>
							<Dropdown
								:options="getMoreOptions(row.name)"
								:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
								placement="right"
							/>
						</ListCell>
					</ListRow>
				</ListRows>
			</List>
			<EmptyStateLayout
				v-else
				name="Badges"
				:description="__('Add one to get started.')"
				icon="lucide-award"
			/>
		</SettingsLayout>
	</template>
	<BadgeForm
		v-else
		:badgeName="selectedBadge"
		v-model:badges="badges"
		@updateStep="(step) => (view = step)"
	/>
	<BadgeAssignments
		v-if="showAssignments"
		v-model="showAssignments"
		:badgeName="showAssignmentsFor"
	/>
</template>
<script setup lang="ts">
import { Badge, Button, Dropdown, createListResource, toast } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { computed, ref } from 'vue'
import { cleanError } from '@/utils'
import BadgeForm from '@/components/Settings/Badges/BadgeForm.vue'
import BadgeAssignments from '@/components/Settings/Badges/BadgeAssignments.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const view = ref<'list' | 'form'>('list')
const selectedBadge = ref<string | null>(null)
const showAssignments = ref<boolean>(false)
const showAssignmentsFor = ref<string | null>(null)

const props = defineProps<{
	label: string
	description: string
}>()

const badges = createListResource({
	doctype: 'LMS Badge',
	fields: [
		'name',
		'title',
		'enabled',
		'description',
		'image',
		'grant_only_once',
		'event',
		'reference_doctype',
		'condition',
		'user_field',
		'field_to_check',
	],
	order_by: 'creation desc',
	auto: true,
})

// Grid track sizes shared by the header and every row (--list-columns).
const columns = [
	'minmax(0, 1.3fr)',
	'minmax(0, 1fr)',
	'7rem',
	'6.5rem',
	'2.25rem',
]

const getMoreOptions = (badgeName: string) => {
	return [
		{
			label: __('Edit'),
			icon: 'lucide-edit',
			onClick() {
				openForm(badgeName)
			},
		},
		{
			label: __('Assignments'),
			icon: 'lucide-download',
			onClick() {
				showAssignmentsFor.value = badgeName
				showAssignments.value = true
			},
		},
		{
			label: __('Delete'),
			icon: 'lucide-trash-2',
			onClick() {
				deleteBadge(badgeName)
			},
		},
	]
}

const openForm = (badgeName: string) => {
	selectedBadge.value = badgeName
	view.value = 'form'
}

const deleteBadge = (badgeName: string) => {
	badges.delete
		.submit(badgeName)
		.then(() => {
			badges.reload()
			toast.success(__('Badge deleted successfully'))
		})
		.catch((err: any) => {
			toast.error(cleanError(err.messages[0]) || __('Error deleting badge'))
		})
}

const doctypeLabel = computed(() => {
	return {
		'LMS Course': __('Course'),
		'LMS Batch': __('Batch'),
		'LMS Enrollment': __('Course Enrollment'),
		'LMS Batch Enrollment': __('Batch Enrollment'),
		'LMS Quiz Submission': __('Quiz Submission'),
		'LMS Assignment Submission': __('Assignment Submission'),
		'LMS Programming Exercise Submission': __(
			'Programming Exercise Submission'
		),
	}
})
</script>
