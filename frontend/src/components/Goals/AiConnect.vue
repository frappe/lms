<template>
	<section
		:aria-labelledby="headingId"
		class="rounded-8 border border-outline-gray-2 bg-surface-base p-5 shadow-sm transition-shadow"
		:class="flash ? 'ring-2 ring-outline-gray-3' : ''"
	>
		<h2 :id="headingId" class="text-lg-semibold text-ink-gray-9">
			{{
				embeddingOnly
					? __('One more key, for search')
					: __('Connect an AI provider')
			}}
		</h2>
		<p class="mt-1 text-p-base text-ink-gray-6">
			{{
				embeddingOnly
					? __(
							'{0} has no embedding model, which Lumi needs to search your material. A Gemini, OpenAI or OpenRouter key covers that part.'
					  ).format(chatProviderLabel)
					: __(
							'One key is enough. Lumi uses it to draft your plans, tutor your learners and search your material.'
					  )
			}}
		</p>
		<form
			class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
			@submit.prevent="submit"
		>
			<FormControl
				v-model="provider"
				type="select"
				variant="outline"
				class="sm:w-48"
				:label="__('Provider')"
				:options="providerOptions"
			/>
			<FormControl
				v-model="apiKey"
				type="password"
				variant="outline"
				class="flex-1"
				:label="__('API key')"
				:placeholder="__('Paste the key')"
				autocomplete="off"
			/>
			<Button
				type="submit"
				variant="solid"
				:label="__('Connect')"
				:loading="connecting"
				:disabled="!apiKey.trim() || !provider"
			/>
		</form>
		<p v-if="connecting" class="mt-2 text-p-sm text-ink-gray-6">
			{{ __('Checking the key and picking the models. About half a minute.') }}
		</p>
		<ErrorMessage class="mt-2" :message="error" />
	</section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Button,
	call,
	createResource,
	ErrorMessage,
	FormControl,
} from 'frappe-ui'

type Provider = { name: string; label: string; embeds: boolean }

const props = defineProps<{
	// A chat model exists but its provider cannot embed: ask for a second key, search only.
	embeddingOnly?: boolean
	chatProvider?: string | null
	flash?: boolean
	headingId?: string
}>()
const emit = defineEmits<{ connected: [] }>()

const headingId = computed(() => props.headingId || 'connect-ai')
const providers = createResource({
	url: 'lms.lms.ai.api.ai_providers',
	auto: true,
}) as { data: Provider[] | null }

const providerOptions = computed(() =>
	((providers.data || []) as Provider[])
		.filter((p) => !props.embeddingOnly || p.embeds)
		.map((p) => ({ label: p.label, value: p.name }))
)
const chatProviderLabel = computed(
	() =>
		((providers.data || []) as Provider[]).find(
			(p) => p.name === props.chatProvider
		)?.label || props.chatProvider
)

const provider = ref('')
// The first listed provider is selected from the start, so the key is the only thing to fill in.
watch(
	providerOptions,
	(options) => {
		if (!options.some((o) => o.value === provider.value))
			provider.value = options[0]?.value || ''
	},
	{ immediate: true }
)
const apiKey = ref('')
const connecting = ref(false)
const error = ref('')

const submit = async () => {
	if (!provider.value && providerOptions.value.length)
		provider.value = providerOptions.value[0].value
	connecting.value = true
	error.value = ''
	try {
		const result = await call('lms.lms.ai.api.connect_ai', {
			provider: provider.value,
			api_key: apiKey.value.trim(),
			embedding_only: props.embeddingOnly ? 1 : 0,
		})
		if (!result.ok) {
			error.value = result.message
			return
		}
		apiKey.value = ''
		emit('connected')
	} catch (e: any) {
		error.value = e?.messages?.[0] || __('Something went wrong. Try again.')
	} finally {
		connecting.value = false
	}
}

defineExpose({ providerOptions })
</script>
