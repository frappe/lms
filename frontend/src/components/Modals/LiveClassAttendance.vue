<template>
	<Dialog
		v-model:open="show"
		:title="__('Attendance for Class - {0}').format(live_class?.title)"
		size="4xl"
	>
		<template #default>
			<div
				class="grid grid-cols-2 gap-12 text-sm-semibold text-ink-gray-5 pb-2"
			>
				<div>
					{{ __('Member') }}
				</div>
				<div class="grid grid-cols-3 gap-20">
					<div>
						{{ __('Joined at') }}
					</div>
					<div class="text-center">
						{{ __('Left at') }}
					</div>
					<div>
						{{ __('Attended for') }}
					</div>
				</div>
			</div>
			<div class="divide-y text-base">
				<component
					:is="participant.member_username ? 'router-link' : 'div'"
					v-for="participant in participants.data"
					:key="participant.name"
					:to="profileRoute(participant.member_username)"
					class="grid grid-cols-2 items-center w-full text-base w-fit py-2"
				>
					<div class="flex items-center gap-x-2">
						<Avatar
							:image="participant.member_image"
							:label="participant.member_name"
							size="xl"
						/>
						<div class="space-y-1">
							<div class="font-medium">
								{{ participant.member_name }}
							</div>
							<div>
								{{ participant.member }}
							</div>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-20 text-end">
						<div>
							{{ dayjs(participant.joined_at).format('HH:mm a') }}
						</div>
						<div>
							{{ dayjs(participant.left_at).format('HH:mm a') }}
						</div>
						<div>{{ participant.duration }} {{ __('minutes') }}</div>
					</div>
				</component>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Avatar, createListResource, Dialog, Tooltip } from 'frappe-ui'
import { inject } from 'vue'
import { profileRoute } from '@/utils/routes'

const show = defineModel()
const dayjs = inject('$dayjs')

interface LiveClass {
	name: String
	title: String
}

const props = defineProps<{
	live_class: LiveClass | null
}>()

const participants = createListResource({
	doctype: 'LMS Live Class Participant',
	filter: {
		live_class: props.live_class?.name,
	},
	fields: [
		'name',
		'member',
		'member_name',
		'member_image',
		'member_username',
		'joined_at',
		'left_at',
		'duration',
	],
	auto: true,
})
</script>
