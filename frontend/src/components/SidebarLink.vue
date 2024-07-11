<template>
	<button
		v-if="link && !link.onlyMobile"
		class="flex h-7 cursor-pointer items-center rounded text-gray-800 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-gray-400"
		:class="isActive ? 'bg-white shadow-sm' : 'hover:bg-gray-100'"
		@click="handleClick"
	>
		<div
			class="flex items-center w-full duration-300 ease-in-out group"
			:class="isCollapsed ? 'p-1' : 'px-2 py-1'"
		>
			<Tooltip :text="link.label" placement="right">
				<slot name="icon">
					<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
						<component
							:is="icons[link.icon]"
							class="h-4 w-4 stroke-1.5 text-gray-800"
						/>
					</span>
				</slot>
			</Tooltip>
			<span
				class="flex-shrink-0 text-sm duration-300 ease-in-out"
				:class="
					isCollapsed
						? 'ml-0 w-0 overflow-hidden opacity-0'
						: 'ml-2 w-auto opacity-100'
				"
			>
				{{ link.label }}
			</span>
			<span v-if="link.count" class="!ml-auto block text-xs text-gray-600">
				{{ link.count }}
			</span>
			<div
				v-if="showControls && !isCollapsed"
				class="flex items-center space-x-2 !ml-auto block text-xs text-gray-600 group-hover:visible invisible"
			>
				<component
					:is="icons['Edit']"
					class="h-3 w-3 stroke-1.5 text-gray-700"
					@click.stop="openModal(link)"
				/>
				<component
					:is="icons['X']"
					class="h-3 w-3 stroke-1.5 text-gray-700"
					@click.stop="deletePage(link)"
				/>
			</div>
		</div>
	</button>
</template>
<script setup>
import { Tooltip, Button } from 'frappe-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import * as icons from 'lucide-vue-next'

const router = useRouter()
const emit = defineEmits(['openModal', 'deletePage'])

const props = defineProps({
	link: {
		type: Object,
		required: true,
	},
	isCollapsed: {
		type: Boolean,
		default: false,
	},
	showControls: {
		type: Boolean,
		default: false,
	},
})

function handleClick() {
	if (router.hasRoute(props.link.to)) {
		router.push({ name: props.link.to })
	} else if (props.link.to) {
		window.location.href = `/${props.link.to}`
	}
}

const isActive = computed(() => {
	return props.link?.activeFor?.includes(router.currentRoute.value.name)
})

const openModal = (link) => {
	emit('openModal', link)
}

const deletePage = (link) => {
	emit('deletePage', link)
}
</script>
