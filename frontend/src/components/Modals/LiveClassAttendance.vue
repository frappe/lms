<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Attendance for Class - {0}').format(live_class?.title),
			size: '4xl',
		}"
	>
		<template #body-content>
			<div
				class="grid grid-cols-2 gap-12 text-sm font-semibold text-ink-gray-5 pb-2"
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
				<div
					v-for="participant in participants.data"
					@click="redirectToProfile(participant.member_username)"
					class="grid grid-cols-2 items-center w-full text-base w-fit py-2"
				>
					<div class="flex items-center space-x-2">
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

					<div class="grid grid-cols-3 gap-20 text-right">
						<div>
							{{ dayjs(participant.joined_at).format('HH:mm a') }}
						</div>
						<div>
							{{ dayjs(participant.left_at).format('HH:mm a') }}
						</div>
						<div>{{ participant.duration }} {{ __('minutes') }}</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Avatar, createListResource, Dialog, Tooltip } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { inject } from 'vue'

const show = defineModel()
const router = useRouter()
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

const redirectToProfile = (username: string) => {
	router.push({
		name: 'Profile',
		params: { username },
	})
}
</script>
