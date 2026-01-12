<template>
	<button
		v-if="link && !link.onlyMobile"
		class="flex w-full cursor-pointer items-center rounded text-gray-600 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-outline-gray-3"
		
		:class="
			isActive ? 'bg-surface-selected shadow-sm' : 'hover:bg-surface-gray-2',
			isCollapsed ? 'h-8 my-2' : 'h-12'
		"
		
		@click="handleClick"
	>
		<div
			class="flex items-center w-full duration-300 ease-in-out group "
			:class="isCollapsed ? 'p-1 py-1 relative' : 'px-3 py-1'"
		>
			<Tooltip :text="__(link.label)" placement="right">
				<slot name="icon">
					<span class="grid h-6 w-6 flex-shrink-0 place-items-center">
						<component
							:is="icons[link.icon]"
							class="h-4.5 w-4.5 stroke-1.5"
						/>
					</span>
				</slot>
			</Tooltip>
			<span
				class="flex-shrink-0 text-sm font-medium duration-300 ease-in-out"
				:class="
					isCollapsed
						? 'ml-0 w-0 overflow-hidden opacity-0'
						: 'ml-2 w-auto opacity-100'
				"
			>
				{{ __(link.label) }}
			</span>
			<span
				v-if="link.count && !isCollapsed"
				class="!ml-auto block text-xs text-ink-gray-5"
				:class="
					isCollapsed && link.count > 9
						? 'absolute top-[2px] right-0 bg-surface-white'
						: ''
				"
			>
				{{ link.count }}
			</span>
			<div
				v-if="showControls && !isCollapsed"
				class="flex items-center space-x-2 !ml-auto text-xs text-ink-gray-5 group-hover:visible invisible"
			>
				<component
					:is="icons['Edit']"
					class="h-3 w-3 stroke-1.5 text-ink-gray-7"
					@click.stop="openModal(link)"
				/>
				<component
					:is="icons['X']"
					class="h-5 w-3 stroke-1.5 text-ink-gray-7"
					@click.stop="deletePage(link)"
				/>
			</div>
		</div>
	</button>
	<ContactUsEmail v-model="showContactForm" />
</template>
<script setup>
import { Tooltip } from 'frappe-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ContactUsEmail from '@/components/ContactUsEmail.vue'
import * as LucideIcons from 'lucide-vue-next'
import HomeIcon from '@/components/Icons/HomeIcon.vue'
import CoursesIcon from '@/components/Icons/CoursesIcon.vue'
import BatchesIcon from '@/components/Icons/BatchesIcon.vue'
import StatisticsIcon from '@/components/Icons/StatisticsIcon.vue'

const icons = {
    ...LucideIcons,
    HomeIcon,
    CoursesIcon,
    BatchesIcon,
    StatisticsIcon
}

const router = useRouter()
const emit = defineEmits(['openModal', 'deletePage'])
const showContactForm = ref(false)

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
	activeTab: {
		type: String,
		default: '',
	},
})

function handleClick() {
	if (router.hasRoute(props.link.to)) {
		router.push({ name: props.link.to })
	} else if (props.link.to?.includes('@')) {
		showContactForm.value = true
	} else if (props.link.to) {
		if (props.link.to.startsWith('http')) {
			window.open(props.link.to, '_blank')
			return
		}
		window.location.href = `/${props.link.to}`
	}
}

const isActive = computed(() => {
	return (
		props.link?.activeFor?.includes(router.currentRoute.value.name) ||
		(props.activeTab && props.link?.label?.includes(props.activeTab))
	)
})

const openModal = (link) => {
	emit('openModal', link)
}

const deletePage = (link) => {
	emit('deletePage', link)
}
</script>
