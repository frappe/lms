<template>
	<Dialog v-model:open="open" :title="title" size="lg">
		<template #default>
			<div class="space-y-4">
				<p v-if="body" class="text-p-base text-ink-gray-7">{{ body }}</p>
				<slot />
				<FormControl
					v-if="input"
					v-model="note"
					type="textarea"
					:rows="4"
					:label="inputLabel || title"
					:required="required"
					data-testid="copilot-note-input"
				/>
				<p v-if="missing" class="text-p-sm text-ink-red-6" role="alert">
					{{ __('Please fill in this field.') }}
				</p>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="flex justify-end gap-2">
				<Button :label="__('Cancel')" variant="ghost" @click="close()" />
				<Button
					:label="confirmLabel || __('Confirm')"
					variant="solid"
					:theme="confirmTheme"
					data-testid="copilot-note-confirm"
					@click="confirm(close)"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Button, Dialog, FormControl } from 'frappe-ui'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
	title: { type: String, required: true },
	body: { type: String, default: '' },
	input: { type: Boolean, default: false },
	inputLabel: { type: String, default: '' },
	required: { type: Boolean, default: false },
	confirmLabel: { type: String, default: '' },
	confirmTheme: { type: String, default: 'gray' },
})

const emit = defineEmits(['confirm'])

const note = ref('')
const missing = ref(false)

watch(open, (value) => {
	if (value) {
		note.value = ''
		missing.value = false
	}
})

function confirm(close) {
	const value = props.input ? note.value.trim() : true
	if (props.input && props.required && !value) {
		missing.value = true
		return
	}
	close()
	emit('confirm', value)
}
</script>
