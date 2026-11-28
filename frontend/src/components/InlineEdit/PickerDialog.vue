<template>
	<Dialog v-model:open="open" size="2xl" :title="title">
		<template #default>
			<div class="flex items-center gap-2">
				<FormControl
					v-model="query"
					type="text"
					class="flex-1"
					:placeholder="searchPlaceholder || __('Search')"
					:aria-label="searchPlaceholder || __('Search')"
				>
					<template #prefix>
						<span class="lucide-search size-4 text-ink-gray-5" />
					</template>
				</FormControl>
				<CategoryFilter
					v-if="categories?.length"
					v-model="category"
					:categories="categories"
					:label="filterLabel?.name"
					:allLabel="filterLabel?.all"
				/>
			</div>

			<div class="-mx-2 mt-4 h-[55vh] overflow-y-auto px-2">
				<label
					v-for="item in visible"
					:key="item.value"
					class="flex w-full cursor-pointer items-center gap-3 rounded-5 p-2 hover:bg-surface-gray-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-outline-gray-3"
					:data-testid="'pick-' + item.value"
				>
					<span
						class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-4"
						:class="item.image ? 'bg-surface-gray-2' : item.tint"
					>
						<img
							v-if="item.image"
							:src="safeUrl(item.image)"
							alt=""
							class="size-full object-cover"
						/>
						<span
							v-else
							:class="[item.icon || 'lucide-book-open', 'size-5']"
							aria-hidden="true"
						/>
					</span>
					<span class="min-w-0 flex-1">
						<span
							:id="titleId(item.value)"
							class="block truncate text-base-medium text-ink-gray-9"
						>
							{{ item.title }}
						</span>
						<span
							class="mt-0.5 flex items-center gap-1.5 truncate text-p-sm text-ink-gray-6"
						>
							<template v-for="(fact, index) in item.meta" :key="index">
								<span v-if="index" aria-hidden="true">·</span>
								<span
									:class="index === 0 && fact === item.category && 'uppercase'"
								>
									{{ fact }}
								</span>
							</template>
							<span
								v-if="item.rating"
								class="flex items-center gap-0.5 ps-1"
								:aria-label="__('Rated {0}').format(item.rating)"
							>
								<span class="lucide-star size-3.5 text-ink-amber-5" />
								{{ item.rating }}
							</span>
						</span>
					</span>
					<Checkbox
						size="md"
						class="shrink-0"
						:modelValue="isPicked(item.value)"
						:aria-labelledby="titleId(item.value)"
						@update:modelValue="toggle(item.value)"
					/>
				</label>
				<p
					v-if="!visible.length"
					class="py-8 text-center text-p-sm text-ink-gray-6"
				>
					{{ __('Nothing matches.') }}
				</p>
			</div>
		</template>

		<template #actions>
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-p-sm text-ink-gray-6">
					{{ __('{0} selected').format(picked.length) }}
				</span>
				<Button v-if="createLabel" variant="ghost" @click="create">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ createLabel }}
				</Button>
				<span class="flex-1" />
				<Button variant="subtle" @click="open = false">
					{{ __('Cancel') }}
				</Button>
				<Button variant="solid" :disabled="!picked.length" @click="add">
					{{ __('Add') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Button, Checkbox, Dialog, FormControl } from 'frappe-ui'
import CategoryFilter from '@/components/Controls/CategoryFilter.vue'
import { safeUrl } from '@/utils/safeUrl'

export interface PickerItem {
	value: string
	title: string
	meta?: string[]
	rating?: number | null
	icon?: string
	tint?: string
	image?: string | null
	category?: string | null
	suggested?: boolean
}

/** Pick several records to add: search, an optional category filter, suggested first. Fixed height, so filtering never resizes it. */
const props = defineProps<{
	title: string
	items: PickerItem[]
	searchPlaceholder?: string
	categories?: string[]
	/** Relabels the category filter, e.g. { name: 'Type', all: 'All types' }. */
	filterLabel?: { name: string; all: string }
	createLabel?: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ add: [values: string[]]; create: [query: string] }>()

const query = ref('')
const category = ref<string | null>(null)
const picked = ref<string[]>([])

watch(open, (isOpen) => {
	if (!isOpen) return
	query.value = ''
	category.value = null
	picked.value = []
})

const visible = computed(() => {
	const text = query.value.trim().toLowerCase()
	return props.items
		.filter(
			(item) =>
				(!text || item.title.toLowerCase().includes(text)) &&
				(!category.value || item.category === category.value)
		)
		.sort((a, b) => Number(Boolean(b.suggested)) - Number(Boolean(a.suggested)))
})

const idPrefix = useId()
const titleId = (value: string): string => `${idPrefix}-${value}`

const isPicked = (value: string): boolean => picked.value.includes(value)

const toggle = (value: string): void => {
	picked.value = isPicked(value)
		? picked.value.filter((current) => current !== value)
		: [...picked.value, value]
}

const add = (): void => {
	emit('add', picked.value)
	open.value = false
}

const create = (): void => {
	emit('create', query.value.trim())
	open.value = false
}
</script>
