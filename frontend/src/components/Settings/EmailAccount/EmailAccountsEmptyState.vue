<template>
	<div
		class="flex h-full min-h-64 w-full grow flex-col items-center justify-center gap-4 px-6 sm:px-4"
	>
		<div class="flex flex-col items-center gap-1">
			<span
				class="text-base-medium text-center text-ink-gray-8 sm:text-lg-medium"
			>
				{{ __('No email accounts yet') }}
			</span>
			<span class="text-center text-p-sm text-ink-gray-6 sm:text-p-base">
				{{ __('Choose a provider to connect one') }}
			</span>
		</div>
		<EmailProviderPicker
			class="w-full max-w-xl"
			:services="services"
			@pick="onPick"
		/>
	</div>
</template>

<script setup lang="ts">
import EmailProviderPicker from './EmailProviderPicker.vue'
import { services } from './emailAccounts'
import type { EmailService } from '@/types'

/**
 * `ListPage.emptyContent`'s component for Email Accounts. Rendered bare by
 * SettingsList (no props, same as `FieldsPage.extra`), so it sources its own
 * data and reports a pick as a plain string hint -- the provider name -- for
 * SettingsList to fold into the same `new` event the header's New button
 * already fires.
 */

const emit = defineEmits<{ pick: [hint: string] }>()

const onPick = (service: EmailService): void => emit('pick', service.name)
</script>
