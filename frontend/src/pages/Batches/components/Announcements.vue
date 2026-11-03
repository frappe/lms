<template>
	<div class="w-[90%] lg:w-[75%] mx-auto mt-5">
		<h2
			v-if="communications.data?.length"
			class="text-ink-gray-9 text-lg-semibold mb-5"
		>
			{{ __('Announcements') }}
		</h2>
		<ul v-if="communications.data?.length" class="list-none">
			<li v-for="comm in communications.data" :key="comm.name">
				<div class="mb-8">
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center">
							<Avatar :label="comm.sender_full_name" size="lg" />
							<div class="ms-2 text-ink-gray-7">
								{{ comm.sender_full_name }}
							</div>
						</div>
						<div class="text-sm">
							{{ timeAgo(comm.communication_date) }}
						</div>
					</div>
					<div
						class="prose prose-sm bg-surface-sidebar !min-w-full px-4 py-2 rounded-5"
						v-safe-html:rich="comm.content"
					></div>
				</div>
			</li>
		</ul>
		<EmptyStateLayout
			v-else-if="communications.data"
			class="min-h-[60vh]"
			name="Announcements"
			icon="lucide-mail"
			width="lg"
			:title="__('No announcements yet')"
			:description="emptyDescription"
		>
			<Button
				v-if="canAnnounce"
				variant="solid"
				:label="hasStudents ? __('Make Announcement') : __('Enroll Students')"
				@click="openForm"
			>
				<template #prefix>
					<span
						:class="hasStudents ? 'lucide-send' : 'lucide-plus'"
						class="size-4"
					/>
				</template>
			</Button>
		</EmptyStateLayout>
	</div>
</template>
<script setup>
import { createResource, Avatar, Button } from 'frappe-ui'
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { timeAgo } from '@/utils'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { openBatchForm } from '@/composables/useBatchForms'

const props = defineProps({
	batch: {
		type: Object,
		required: true,
	},
})

const user = inject('$user')
const router = useRouter()
const route = useRoute()

// Same people as the header's Make Announcement button.
const canAnnounce = computed(
	() =>
		!window.read_only_mode &&
		Boolean(
			user.data?.is_moderator ||
				user.data?.is_evaluator ||
				props.batch.data?.can_manage
		)
)

// A batch with no students has nobody to announce to, so the first step is students.
const hasStudents = computed(() => Boolean(props.batch.data?.student_count))

const emptyDescription = computed(() => {
	if (!canAnnounce.value) {
		return __('Messages from your instructors about this batch show up here.')
	}
	return hasStudents.value
		? __(
				'Send everyone in this batch a message, like a schedule change or a reminder before a live class.'
		  )
		: __(
				'Enroll students in the batch, then send them messages like a schedule change or a class reminder.'
		  )
})

function openForm() {
	const form = hasStudents.value ? 'NewAnnouncement' : 'NewBatchStudent'
	openBatchForm(router, form, props.batch.data.name, route.hash)
}

const communications = createResource({
	url: 'lms.lms.api.get_announcements',
	makeParams(value) {
		return {
			batch: props.batch.data?.name,
		}
	},
	auto: true,
	cache: ['announcement', props.batch],
})
</script>
<style>
.prose-sm p {
	margin: 0 0 0.5rem;
}
</style>
