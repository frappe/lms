<template>
	<div class="space-y-1.5">
		<label class="block text-xs text-gray-600">
			{{ label }}
		</label>
		<div class="w-full">
			<Popover>
				<template #target="{ togglePopover }">
					<FormControl
						v-model="selectedIcon"
						@focus="openPopover(togglePopover)"
						:placeholder="__('Choose an icon')"
						class="w-full"
					>
						<template #prefix>
							<component
								v-if="selectedIcon"
								class="w-4 h-4 text-gray-700 stroke-1.5"
								:is="icons[selectedIcon]"
							/>
							<component
								v-else
								class="w-4 h-4 text-gray-700 stroke-1.5"
								:is="icons.Folder"
							/>
						</template>
					</FormControl>
				</template>
				<template #body-main="{ close, isOpen }" class="w-full">
					<div class="p-3 max-h-56 overflow-auto w-full">
						<FormControl
							v-model="iconQuery"
							:placeholder="__('Search for an icon')"
							class="search-input"
						/>
						<div class="grid grid-cols-10 gap-4 mt-4">
							<div v-for="(iconComponent, iconName) in filteredIcons">
								<component
									:is="iconComponent"
									class="h-4 w-4 stroke-1.5 text-gray-700 cursor-pointer"
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
import { ref, computed } from 'vue'

const iconQuery = ref('')
const selectedIcon = ref('')
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
	setTimeout(() => {
		document.querySelector('.search-input').focus()
	}, 0)
}
</script>
