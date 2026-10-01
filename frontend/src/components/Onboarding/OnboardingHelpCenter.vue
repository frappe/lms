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
					<LucideSearch class="size-4 text-ink-gray-5" aria-hidden="true" />
				</template>
			</TextInput>
		</div>
		<div
			class="flex justify-between items-center text-base text-ink-gray-5 mx-2"
		>
			<div>{{ text.allArticles }}</div>
			<Button variant="ghost" :aria-label="text.openDocs" @click="openDocs">
				<LucideArrowUpRight class="size-4 text-ink-gray-5" aria-hidden="true" />
			</Button>
		</div>
		<div class="flex flex-col gap-1.5 overflow-y-auto">
			<div
				v-for="a in parsedArticles"
				:key="a.title"
				class="flex flex-col gap-1.5"
			>
				<button
					type="button"
					class="flex w-full items-center justify-between p-1.5 hover:bg-surface-gray-1 rounded-4 cursor-pointer text-start"
					:aria-expanded="Boolean(a.opened)"
					data-testid="help-article"
					@click="a.opened = !a.opened"
				>
					<div class="flex items-center gap-2">
						<LucideChevronDown
							v-if="a.opened"
							class="size-4 text-ink-gray-5"
							aria-hidden="true"
						/>
						<LucideChevronRight
							v-else
							class="size-4 text-ink-gray-5 rtl:rotate-180"
							aria-hidden="true"
						/>
						<div class="text-base text-ink-gray-8">{{ a.title }}</div>
					</div>
				</button>
				<div v-show="a.opened" class="flex flex-col gap-1.5 ms-5">
					<button
						v-for="subArticle in a.subArticles"
						:key="subArticle.name"
						type="button"
						class="group flex w-full items-center justify-between gap-2 p-1.5 hover:bg-surface-gray-1 rounded-4 cursor-pointer text-start"
						data-testid="help-subarticle"
						@click="openDoc(subArticle.name)"
					>
						<div class="flex items-center gap-2">
							<LucideFileText
								class="size-4 text-ink-gray-5"
								aria-hidden="true"
							/>
							<div class="text-base text-ink-gray-8">
								{{ subArticle.title }}
							</div>
						</div>
						<LucideArrowUpRight
							class="size-4 hidden group-hover:flex text-ink-gray-5"
							aria-hidden="true"
						/>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// A copy of the framework's Onboarding/HelpCenter.vue (not exported from
// @framework/ui), with buttons for the clickable rows and openExternal for links.
import { computed, ref } from 'vue'
import { Button, TextInput } from 'frappe-ui'
import type { HelpArticle } from '@framework/ui/components/Onboarding/index'
import { openExternal } from '@/utils/openExternal'

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
