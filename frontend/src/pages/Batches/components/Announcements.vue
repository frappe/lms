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
			v-else-if="communications.data && canAnnounce && !hasStudents"
			class="min-h-[60vh]"
			name="Announcements"
			icon="lucide-users"
			width="lg"
			:title="__('No one to announce to yet')"
			:description="
				__(
					'Announcements reach everyone enrolled in this batch. Enroll students first, then send them updates like a schedule change or a class reminder.'
				)
			"
		>
			<Button
				variant="subtle"
				:label="__('Enroll Students')"
				@click="enrollStudents"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
			</Button>
		</EmptyStateLayout>
		<EmptyStateLayout
			v-else-if="communications.data"
			class="min-h-[60vh]"
			name="Announcements"
			icon="lucide-mail"
			width="lg"
			:title="__('No announcements yet')"
			:description="
				canAnnounce
					? __(
							'Send everyone in this batch a message, like a schedule change or a reminder before a live class.'
					  )
					: __('Messages from your instructors about this batch show up here.')
			"
		>
			<Button
				v-if="canAnnounce"
				variant="subtle"
				:label="__('Make Announcement')"
				@click="
					openBatchForm(router, 'NewAnnouncement', batch.data.name, route.hash)
				"
			>
				<template #prefix>
					<span class="lucide-send size-4" />
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

const hasStudents = computed(() => Boolean(props.batch.data?.student_count))

// Students are enrolled from the dashboard, so open the form over that tab.
function enrollStudents() {
	openBatchForm(router, 'NewBatchStudent', props.batch.data.name, '#dashboard')
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
