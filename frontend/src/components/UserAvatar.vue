<template>
	<Avatar
		class="avatar border border-outline-gray-2 cursor-auto"
		v-if="user"
		:label="user.full_name"
		:image="user.user_image"
		:size="size"
		v-bind="$attrs"
	>
		<template v-if="user.looking_for_job" #indicator>
			<Tooltip :text="__('Open to Opportunities')" placement="right">
				<div class="rounded-full bg-surface-green-3 w-fit">
					<BadgeCheckIcon :class="'text-ink-white ' + checkSize" />
				</div>
			</Tooltip>
		</template>
	</Avatar>
</template>
<script setup>
import { Avatar, Tooltip } from 'frappe-ui'
import { BadgeCheckIcon } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps({
	user: {
		type: Object,
		default: null,
	},
	size: {
		type: String,
	},
})

const checkSize = computed(() => {
	let sizeMap = {
		sm: 'size-1',
		md: 'size-2',
		lg: 'size-3',
		xl: 'size-3',
		'2xl': 'size-3',
	}
	return sizeMap[props.size] || 'size-3'
})
</script>
