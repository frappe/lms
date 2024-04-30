<template>
	<div class="mt-7 mb-10">
		<h2 class="mb-3 text-lg font-semibold text-gray-900">
			{{ __('Achievements') }}
		</h2>
		<div class="grid grid-cols-5 gap-4">
			<div v-if="badges.data" v-for="badge in badges.data">
				<Popover trigger="hover" hoverDelay="0.0">
					<template #target>
						<img :src="badge.badge_image" :alt="badge.badge" class="h-[80px]" />
					</template>
					<template #body-main>
						<div class="w-[250px] text-base">
							<img
								:src="badge.badge_image"
								:alt="badge.badge"
								class="bg-gray-100 rounded-t-md"
							/>
							<div class="p-5">
								<div class="text-2xl font-semibold mb-2">
									{{ badge.badge }}
								</div>
								<div class="mb-4">
									{{ badge.badge_description }}
								</div>
								<div class="flex flex-col">
									<span class="text-xs text-gray-700 font-medium mb-1">
										{{ __('Issued on') }}:
									</span>
									{{ dayjs(badge.issued_on).format('DD MMM YYYY') }}
								</div>
							</div>
						</div>
					</template>
				</Popover>
			</div>
		</div>
	</div>
</template>
<script setup>
import { createResource, Popover } from 'frappe-ui'
import BadgePopover from '@/components/BadgePopover.vue'
import { inject } from 'vue'

const dayjs = inject('$dayjs')

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

const badges = createResource({
	url: 'frappe.client.get_list',
	params: {
		doctype: 'LMS Badge Assignment',
		fields: ['name', 'badge', 'badge_image', 'badge_description', 'issued_on'],
		filters: {
			member: props.profile.data.name,
		},
	},
	auto: true,
})
</script>
