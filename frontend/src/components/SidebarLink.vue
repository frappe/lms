<template>
	<button
		v-if="link && !link.onlyMobile"
		class="flex h-7 cursor-pointer items-center rounded text-gray-800 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-gray-400"
		:class="isActive ? 'bg-white shadow-sm' : 'hover:bg-gray-100'"
		@click="handleClick"
	>
		<div
			class="flex items-center duration-300 ease-in-out"
			:class="isCollapsed ? 'p-1' : 'px-2 py-1'"
		>
			<Tooltip :text="link.label" placement="right">
				<slot name="icon">
					<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
						<component
							:is="link.icon"
							class="h-5 w-5 stroke-1.5 text-gray-800"
						/>
					</span>
				</slot>
			</Tooltip>
			<span
				class="flex-shrink-0 text-base duration-300 ease-in-out"
				:class="
					isCollapsed
						? 'ml-0 w-0 overflow-hidden opacity-0'
						: 'ml-2 w-auto opacity-100'
				"
			>
				{{ link.label }}
			</span>
		</div>
	</button>
</template>

<script setup>
import { Tooltip } from 'frappe-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const props = defineProps({
	link: {
		type: Object,
		required: true,
	},
	isCollapsed: {
		type: Boolean,
		default: false,
	},
})

function handleClick() {
	router.push({ name: props.link.to })
}

let isActive = computed(() => {
	return props.link?.activeFor?.includes(router.currentRoute.value.name)
})
</script>
