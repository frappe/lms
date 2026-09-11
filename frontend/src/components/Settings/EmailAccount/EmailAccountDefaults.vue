<template>
	<div>
		<div class="text-p-lg-semibold text-ink-gray-8 mb-1">
			{{ __('Default Settings') }}
		</div>
		<div class="divide-y divide-outline-elevation-2">
			<div class="flex items-center justify-between gap-4 py-3">
				<div class="flex flex-col">
					<div class="text-p-base-medium text-ink-gray-7">
						{{ __('Default Incoming') }}
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Replies to your organisation arrive at this account.') }}
					</div>
				</div>
				<div class="shrink-0">
					<Tooltip
						:text="
							incomingOptions.length
								? undefined
								: __('Add an email account to set one as your default.')
						"
					>
						<Combobox
							:model-value="defaultIncoming"
							:options="incomingOptions"
							:disabled="!incomingOptions.length"
							:placeholder="__('No default set')"
							:aria-label="__('Default Incoming account')"
							class="w-56"
							@update:model-value="(value) => pick('incoming', value)"
						/>
					</Tooltip>
				</div>
			</div>
			<div class="flex items-center justify-between gap-4 py-3">
				<div class="flex flex-col">
					<div class="text-p-base-medium text-ink-gray-7">
						{{ __('Default Outgoing') }}
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Outgoing mail is sent from this account.') }}
					</div>
				</div>
				<div class="shrink-0">
					<Tooltip
						:text="
							outgoingOptions.length
								? undefined
								: __('Add an email account to set one as your default.')
						"
					>
						<Combobox
							:model-value="defaultOutgoing"
							:options="outgoingOptions"
							:disabled="!outgoingOptions.length"
							:placeholder="__('No default set')"
							:aria-label="__('Default Outgoing account')"
							class="w-56"
							@update:model-value="(value) => pick('outgoing', value)"
						/>
					</Tooltip>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { call, Combobox, toast, Tooltip } from 'frappe-ui'
import { computed } from 'vue'
import { cleanError } from '@/utils'
import {
	reloadSettingsLists,
	useSettingsMethodResource,
} from '@/composables/useSettingsListResource'
import {
	DOCTYPE,
	EMAIL_ACCOUNT_METHODS,
	EMAIL_ACCOUNTS_PAGE_LENGTH,
} from './emailAccounts'

/**
 * A second way to set the same two site-wide defaults the Email Accounts
 * list already offers per row. Reads through the same list method and writes
 * through the same endpoint, so the two stay in sync without either owning
 * the other.
 */

interface EmailAccountRow {
	name: string
	email_account_name: string
	email_id: string
	enable_incoming: boolean | number
	enable_outgoing: boolean | number
	default_incoming: boolean | number
	default_outgoing: boolean | number
}

type Kind = 'incoming' | 'outgoing'

const source = useSettingsMethodResource<EmailAccountRow>({
	method: EMAIL_ACCOUNT_METHODS.list,
	doctype: DOCTYPE,
	pageLength: EMAIL_ACCOUNTS_PAGE_LENGTH,
	auto: false,
})

// The list method pages at 13; the picker needs every account or it could
// silently omit one from the options. Paged through in full up front, since
// nothing here offers a Load More of its own.
async function loadAll(): Promise<void> {
	await source.reload()
	while (source.hasNextPage) await source.loadMore()
}
loadAll()

const accounts = computed(() => source.rows)

// A default counts only for a direction the account is enabled for, the same
// reading the Email Accounts list's own row menu and role badge take: frappe
// resolves a default inbox as `enable_incoming` AND `default_incoming`.
const enabledFor = (row: EmailAccountRow, kind: Kind) =>
	Boolean(kind === 'incoming' ? row.enable_incoming : row.enable_outgoing)

const defaultFor = (row: EmailAccountRow, kind: Kind) =>
	Boolean(kind === 'incoming' ? row.default_incoming : row.default_outgoing)

const optionsFor = (kind: Kind) =>
	computed(() =>
		accounts.value
			.filter((row) => enabledFor(row, kind))
			.map((row) => ({
				label: row.email_account_name || row.name,
				value: row.name,
				description: row.email_id,
			}))
	)

const incomingOptions = optionsFor('incoming')
const outgoingOptions = optionsFor('outgoing')

const currentFor = (kind: Kind) =>
	computed(
		() =>
			accounts.value.find(
				(row) => enabledFor(row, kind) && defaultFor(row, kind)
			)?.name ?? null
	)

const defaultIncoming = currentFor('incoming')
const defaultOutgoing = currentFor('outgoing')

// reloadSettingsLists refetches every list showing this doctype, this one
// included, so a change made here is reflected on the Email Accounts list
// too if it happens to be mounted. That call only lands the first page, so
// the pagination loop continues where loadAll() left off.
const pick = async (kind: Kind, value: string | null) => {
	try {
		await call(EMAIL_ACCOUNT_METHODS.setDefault, {
			email_account: value ?? '',
			kind,
		})
		await reloadSettingsLists(DOCTYPE)
		while (source.hasNextPage) await source.loadMore()
	} catch (err: any) {
		toast.error(
			cleanError(err.messages?.[0] || err) || __('Could not set the default')
		)
	}
}
</script>
