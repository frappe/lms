<template>
	<div class="space-y-1.5">
		<label class="block text-xs text-ink-gray-5">
			{{ label }}
		</label>
		<div class="w-full">
			<Popover>
				<template #target="{ togglePopover }">
					<button
						@click="openPopover(togglePopover)"
						class="flex w-full items-center space-x-2 focus:outline-none bg-surface-gray-2 rounded h-7 py-1.5 px-2 hover:bg-surface-gray-3 focus:bg-surface-white border border-gray-100 hover:border-outline-gray-modals focus:border-outline-gray-4"
					>
						<component
							v-if="selectedIcon"
							class="w-4 h-4 text-ink-gray-7 stroke-1.5"
							:is="icons[selectedIcon]"
						/>
						<component
							v-else
							class="w-4 h-4 text-ink-gray-7 stroke-1.5"
							:is="icons.Folder"
						/>
						<span v-if="selectedIcon">
							{{ selectedIcon }}
						</span>
						<span v-else class="text-ink-gray-5">
							{{ __('Choose an icon') }}
						</span>
					</button>
				</template>
				<template #body-main="{ close, isOpen }" class="w-full">
					<div class="p-3 max-h-56 overflow-auto w-full">
						<FormControl
							ref="search"
							v-model="iconQuery"
							:placeholder="__('Search for an icon')"
							autocomplete="off"
						/>
						<div class="grid grid-cols-10 gap-4 mt-4">
							<div v-for="(iconComponent, iconName) in filteredIcons">
								<component
									:is="iconComponent"
									class="h-4 w-4 stroke-1.5 text-ink-gray-7 cursor-pointer"
									@click="setIcon(iconName, close)"
								/>
							</div>
						</div>
					</div>
				</template>
			</Popover>
		</div>
	</div>
</template>
<script setup>
import { FormControl, Popover } from 'frappe-ui'
import * as icons from 'lucide-vue-next'
import { ref, computed, onMounted, nextTick } from 'vue'

const iconQuery = ref('')
const selectedIcon = ref('')
const search = ref(null)
const emit = defineEmits(['update:modelValue', 'change'])

const iconArray = ref(
	Object.keys(icons)
		.sort(() => 0.5 - Math.random())
		.slice(0, 100)
		.reduce((result, key) => {
			result[key] = icons[key]
			return result
		}, {})
)

const props = defineProps({
	label: {
		type: String,
		default: 'Icon',
	},
	modelValue: {
		type: String,
		default: '',
	},
})

onMounted(() => {
	selectedIcon.value = props.modelValue
})

const setIcon = (icon, close) => {
	emit('update:modelValue', icon)
	selectedIcon.value = icon
	iconQuery.value = ''
	close()
}

const filteredIcons = computed(() => {
	if (!iconQuery.value) {
		return iconArray.value
	}

	return Object.keys(icons)
		.filter((icon) =>
			icon.toLowerCase().includes(iconQuery.value.toLowerCase())
		)
		.reduce((result, key) => {
			result[key] = icons[key]
			return result
		}, {})
})

const openPopover = (togglePopover) => {
	togglePopover()
}
</script>
