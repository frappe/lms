<template>
	<Tooltip :text="user.full_name">
		<Avatar
			class="avatar border border-outline-gray-2 cursor-auto"
			v-if="user"
			:label="user.full_name"
			:image="user.user_image"
			:size="size"
			v-bind="$attrs"
		/>
	</Tooltip>
</template>
<script setup>
import { Avatar, Tooltip } from 'frappe-ui'
const props = defineProps({
	user: {
		type: Object,
		default: null,
	},
	size: {
		type: String,
	},
})
</script>
