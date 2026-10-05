<template>
	<div>
		<div class="text-p-lg-semibold text-ink-gray-8 mb-3">
			{{ __('Choose your provider') }}
		</div>
		<EmailProviderPicker :services="services" @pick="onPick" />
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
 *
 * No SettingsHeader of its own: just the plain heading Helpdesk draws above
 * its own provider grid, under the panel's existing "Email Accounts" title.
 */

const emit = defineEmits<{ pick: [hint: string] }>()

const onPick = (service: EmailService): void => emit('pick', service.name)
</script>
