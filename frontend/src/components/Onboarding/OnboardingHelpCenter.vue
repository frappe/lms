<template>
	<div class="flex flex-col gap-2 overflow-hidden">
		<div class="m-1">
			<TextInput
				v-model="search"
				:placeholder="text.search"
				:aria-label="text.search"
				:debounce="300"
			>
				<template #prefix>
					<LucideSearch
						class="text-ink-gray-5"
						:class="SIDEBAR_ICON"
						aria-hidden="true"
					/>
				</template>
			</TextInput>
		</div>
		<div
			class="flex justify-between items-center text-ink-gray-5 mx-2"
			:class="ROW_TEXT"
		>
			<div>{{ text.allArticles }}</div>
			<Button variant="ghost" :aria-label="text.openDocs" @click="openDocs">
				<LucideArrowUpRight
					class="text-ink-gray-5"
					:class="SIDEBAR_ICON"
					aria-hidden="true"
				/>
			</Button>
		</div>
		<div class="flex flex-col gap-0.5 overflow-y-auto">
			<div
				v-for="a in parsedArticles"
				:key="a.title"
				class="flex flex-col gap-0.5"
			>
				<SidebarItem
					:label="a.title"
					:aria-expanded="Boolean(a.opened)"
					data-testid="help-article"
					@click="a.opened = !a.opened"
				>
					<template #prefix>
						<LucideChevronDown
							v-if="a.opened"
							class="text-ink-gray-6"
							:class="SIDEBAR_ICON"
							aria-hidden="true"
						/>
						<LucideChevronRight
							v-else
							class="text-ink-gray-6 rtl:rotate-180"
							:class="SIDEBAR_ICON"
							aria-hidden="true"
						/>
					</template>
					<span class="truncate text-ink-gray-8" :class="ROW_TEXT">
						{{ a.title }}
					</span>
				</SidebarItem>
				<div v-show="a.opened" class="flex flex-col gap-0.5 ms-5">
					<SidebarItem
						v-for="subArticle in a.subArticles"
						:key="subArticle.name"
						:label="subArticle.title"
						data-testid="help-subarticle"
						@click="openDoc(subArticle.name)"
					>
						<template #prefix>
							<LucideFileText
								class="text-ink-gray-6"
								:class="SIDEBAR_ICON"
								aria-hidden="true"
							/>
						</template>
						<span class="truncate text-ink-gray-8" :class="ROW_TEXT">
							{{ subArticle.title }}
						</span>
						<template #suffix>
							<LucideArrowUpRight
								class="me-2 hidden text-ink-gray-5 group-hover/sidebar-item:flex"
								:class="SIDEBAR_ICON"
								aria-hidden="true"
							/>
						</template>
					</SidebarItem>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// A copy of the framework's Onboarding/HelpCenter.vue (not exported from
// @framework/ui). Its rows are the sidebar's SidebarItem rows, and links go
// through openExternal.
import { computed, ref } from 'vue'
import { Button, SidebarItem, TextInput } from 'frappe-ui'
import type { HelpArticle } from '@framework/ui/components/Onboarding/index'
import { openExternal } from '@/utils/openExternal'
import { ROW_TEXT, SIDEBAR_ICON } from '@/onboarding/rowClasses'

const props = defineProps<{ docsLink: string }>()

const articles = defineModel<HelpArticle[]>({ required: true })

const search = ref('')

const text = {
	search: __('Search articles...'),
	allArticles: __('All articles'),
	openDocs: __('Open the documentation'),
}

const parsedArticles = computed<HelpArticle[]>(() => {
	const query = search.value.toLowerCase()
	if (!query) return articles.value
	return articles.value.filter(
		(a) =>
			a.title.toLowerCase().includes(query) ||
			a.subArticles.some((sub) => sub.title.toLowerCase().includes(query))
	)
})

function openDocs(): void {
	openExternal(props.docsLink)
}

function openDoc(name: string): void {
	openExternal(`${props.docsLink}/${name}`)
}
</script>
