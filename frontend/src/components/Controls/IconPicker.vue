<template>
	<div class="space-y-1.5">
		<InputLabel
			v-if="label"
			:id="labelId"
			:for-id="inputId"
			:label="label ? __(label) : undefined"
			:required="required"
		/>
		<div class="w-full">
			<Popover>
				<template #trigger>
					<button
						:id="inputId"
						type="button"
						class="flex w-full items-center gap-x-2 focus:outline-none transition-colors border border-[--surface-gray-2] bg-surface-gray-2 rounded h-7 py-1.5 px-2 hover:border-outline-elevation-2 hover:bg-surface-gray-3 focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-sm focus:ring-0"
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
						<span v-if="selectedIcon" class="text-ink-gray-7">
							{{ selectedIcon }}
						</span>
						<span v-else class="text-ink-gray-5">
							{{ __('Choose an icon') }}
						</span>
					</button>
				</template>
				<template #default="{ close, isOpen }" class="w-full">
					<div class="p-3 max-h-56 overflow-auto w-full">
						<FormControl
							ref="search"
							v-model="iconQuery"
							:placeholder="__('Search for an icon')"
							:aria-label="__('Search for an icon')"
							autocomplete="off"
						/>
						<div class="grid grid-cols-10 gap-4 mt-4">
							<button
								v-for="(iconComponent, iconName) in filteredIcons"
								:key="iconName"
								type="button"
								:aria-label="iconName"
								@click="setIcon(iconName, close)"
							>
								<component
									:is="iconComponent"
									class="h-4 w-4 stroke-1.5 text-ink-gray-7 cursor-pointer"
								/>
							</button>
						</div>
					</div>
				</template>
			</Popover>
		</div>
		<InputDescription
			v-if="showDescription"
			:id="descriptionId"
			:description="description ? __(description) : undefined"
		/>
		<InputError v-if="hasError" :id="errorMessageId" :lines="errorLines" />
	</div>
</template>
<script setup>
import { FormControl, Popover } from 'frappe-ui'
import {
	InputDescription,
	InputError,
	InputLabel,
	useInputLabeling,
} from '@/components/Form/labeling'
import * as icons from 'lucide-vue-next'
import { ref, computed, onMounted } from 'vue'

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
	description: {
		type: String,
		default: undefined,
	},
	required: {
		type: Boolean,
		default: false,
	},
	error: {
		type: String,
		default: undefined,
	},
})

const {
	inputId,
	labelId,
	descriptionId,
	errorMessageId,
	hasError,
	errorLines,
	showDescription,
} = useInputLabeling(props)

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
</script>
