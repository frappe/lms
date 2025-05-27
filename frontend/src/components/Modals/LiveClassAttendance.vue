<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Attendance for Class - {0}').format(live_class?.title),
			size: 'xl',
		}"
	>
		<template #body-content>
			<div class="space-y-5">
				<div
					v-for="participant in participants.data"
					@click="redirectToProfile(participant.member_username)"
					class="cursor-pointer text-base w-fit"
				>
					<Tooltip placement="right">
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
						<template #body>
							<div
								class="max-w-[30ch] rounded bg-surface-gray-7 px-2 py-1 text-p-xs text-ink-white leading-5 shadow-xl"
							>
								{{ dayjs(participant.joined_at).format('HH:mm a') }} -
								{{ dayjs(participant.left_at).format('HH:mm a') }}
								<br />
								{{ __('attended for') }} {{ participant.duration }}
								{{ __('minutes') }}
							</div>
						</template>
					</Tooltip>
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
