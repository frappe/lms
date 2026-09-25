<template>
	<Dialog v-model:open="show" :title="__('Language')" size="md">
		<div class="flex flex-col gap-4">
			<FormControl
				v-model="search"
				:label="__('Search language')"
				type="text"
				:placeholder="__('Type a language name')"
			/>

			<div
				v-if="languages.loading"
				class="py-8 text-center text-p-sm text-ink-gray-6"
			>
				{{ __('Loading languages...') }}
			</div>
			<div
				v-else-if="!filteredLanguages.length"
				class="py-8 text-center text-p-sm text-ink-gray-6"
			>
				{{ __('No languages found') }}
			</div>
			<div v-else class="max-h-80 overflow-y-auto rounded-5 border border-outline-gray-2">
				<button
					v-for="language in filteredLanguages"
					:key="language.name"
					type="button"
					class="flex w-full items-center justify-between border-b border-outline-gray-1 px-3 py-2.5 text-start last:border-b-0 hover:bg-surface-gray-3 disabled:cursor-wait disabled:opacity-60"
					:disabled="Boolean(saving)"
					:aria-current="language.name === currentLanguage ? 'true' : undefined"
					@click="chooseLanguage(language.name)"
				>
					<span class="text-p-sm text-ink-gray-9">{{ language.language_name }}</span>
					<span
						v-if="language.name === currentLanguage"
						class="lucide-check size-4 text-ink-green-2"
						aria-hidden="true"
					/>
					<span v-else-if="saving === language.name" class="text-p-xs text-ink-gray-6">
						{{ __('Saving...') }}
					</span>
				</button>
			</div>

			<p v-if="errorMessage" class="text-p-sm text-ink-red-3" role="alert">
				{{ errorMessage }}
			</p>
		</div>
	</Dialog>
</template>

<script setup>
import { call, createResource, Dialog, FormControl } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { usersStore } from '@/stores/user'

const show = defineModel({ required: true, default: false })
const { userResource } = usersStore()
const search = ref('')
const saving = ref('')
const errorMessage = ref('')

const languages = createResource({
	url: 'lms.lms.api.get_available_languages',
	auto: true,
})

const currentLanguage = computed(() => userResource.data?.language || 'en')

const filteredLanguages = computed(() => {
	const query = search.value.trim().toLowerCase()
	return (languages.data || []).filter((language) => {
		return (
			!query ||
			language.language_name.toLowerCase().includes(query) ||
			language.name.toLowerCase().includes(query)
		)
	})
})

const chooseLanguage = async (language) => {
	if (language === currentLanguage.value || saving.value) return

	saving.value = language
	errorMessage.value = ''
	try {
		await call('lms.lms.api.set_user_language', { language })
		window.location.reload()
	} catch (error) {
		saving.value = ''
		errorMessage.value = __(error?.messages?.[0] || error?.message || 'Unable to save language')
	}
}

watch(show, (isOpen) => {
	if (!isOpen) {
		search.value = ''
		saving.value = ''
		errorMessage.value = ''
	}
})
</script>
