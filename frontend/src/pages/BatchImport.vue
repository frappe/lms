<template>
	<div class="flex flex-col h-full">
		<!-- Header -->
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				:items="[
					{ label: __('Batches'), route: { name: 'Batches' } },
					{ label: __('Import & Assign Users') },
				]"
			/>
		</header>

		<!-- Body -->
		<div class="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
			<div class="text-lg font-semibold text-ink-gray-9">
				{{ __('Import Users & Assign to Batch') }}
			</div>
			<div class="text-sm text-ink-gray-6">
				{{
					__(
						'Select a batch, paste user emails (one per line), and click "Import & Assign" to enroll all users at once.'
					)
				}}
			</div>

			<!-- Batch selector -->
			<div class="space-y-1">
				<label class="block text-sm font-medium text-ink-gray-7">
					{{ __('Batch') }}
					<span class="text-red-500">*</span>
				</label>
				<FormControl
					type="autocomplete"
					:options="batchOptions"
					v-model="selectedBatch"
					:placeholder="__('Select a batch…')"
				/>
			</div>

			<!-- User emails textarea -->
			<div class="space-y-1">
				<label class="block text-sm font-medium text-ink-gray-7">
					{{ __('User Emails') }}
					<span class="text-red-500">*</span>
				</label>
				<textarea
					v-model="userEmailsText"
					rows="10"
					class="block w-full rounded border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm text-ink-gray-9 placeholder-ink-gray-4 focus:border-outline-gray-4 focus:outline-none focus:ring-1 focus:ring-outline-gray-4"
					:placeholder="__('user1@example.com\nuser2@example.com\nuser3@example.com')"
				/>
				<p class="text-xs text-ink-gray-5">
					{{ __('One email per line. Duplicates and already-enrolled users are skipped automatically.') }}
				</p>
			</div>

			<!-- CSV Upload (optional) -->
			<div class="space-y-1">
				<label class="block text-sm font-medium text-ink-gray-7">
					{{ __('Or upload a CSV file') }}
				</label>
				<input
					ref="csvInput"
					type="file"
					accept=".csv,.txt"
					class="block text-sm text-ink-gray-6 file:mr-3 file:rounded file:border-0 file:bg-surface-gray-2 file:px-3 file:py-1 file:text-sm file:font-medium file:text-ink-gray-7 hover:file:bg-surface-gray-3 cursor-pointer"
					@change="handleFileUpload"
				/>
				<p class="text-xs text-ink-gray-5">
					{{ __('CSV must have an "email" column or be a single-column file of email addresses.') }}
				</p>
			</div>

			<!-- Action button -->
			<div class="flex items-center gap-3">
				<Button
					variant="solid"
					:loading="assignResource.loading"
					:disabled="!selectedBatchName || !userList.length"
					@click="submitAssignment"
				>
					{{ __('Import & Assign to Batch') }}
				</Button>
				<Button variant="subtle" @click="reset">
					{{ __('Reset') }}
				</Button>
			</div>

			<!-- Result summary -->
			<div
				v-if="result"
				class="rounded border px-4 py-3 text-sm space-y-1"
				:class="
					result.status === 'Success'
						? 'border-green-200 bg-green-50 text-green-800'
						: result.status === 'Failed'
						? 'border-red-200 bg-red-50 text-red-800'
						: 'border-yellow-200 bg-yellow-50 text-yellow-800'
				"
			>
				<p class="font-medium">
					{{ summaryMessage }}
				</p>
				<ul v-if="result.errors?.length" class="list-disc pl-4 space-y-0.5">
					<li v-for="err in result.errors" :key="err" class="text-xs">
						{{ err }}
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<script setup>
import { Breadcrumbs, Button, FormControl, createResource, toast, usePageMeta } from 'frappe-ui'
import { computed, ref } from 'vue'
import { sessionStore } from '@/stores/session'

const { brand } = sessionStore()

// ── State ─────────────────────────────────────────────────────────────────────
const selectedBatch = ref('')
const userEmailsText = ref('')
const csvInput = ref(null)
const result = ref(null)

// ── Batch list ─────────────────────────────────────────────────────────────────
const batchListResource = createResource({
	url: 'lms.lms.batch_assignment.get_batch_list',
	auto: true,
})

const batchOptions = computed(() =>
	(batchListResource.data || []).map((b) => ({
		label: b.title,
		value: b.name,
	}))
)

// Resolve batch name string regardless of whether autocomplete returns object or string
const selectedBatchName = computed(() =>
	typeof selectedBatch.value === 'object'
		? selectedBatch.value?.value
		: selectedBatch.value
)

// ── Derived user list ──────────────────────────────────────────────────────────
const userList = computed(() =>
	userEmailsText.value
		.split('\n')
		.map((e) => e.trim())
		.filter(Boolean)
)

// ── CSV upload ─────────────────────────────────────────────────────────────────
function handleFileUpload(event) {
	const file = event.target.files[0]
	if (!file) return

	const reader = new FileReader()
	reader.onload = (e) => {
		const text = e.target.result
		const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

		// Detect header row — if the first line contains "email" treat as CSV with header
		const firstLine = lines[0]?.toLowerCase() || ''
		const emailColIndex = firstLine.split(',').findIndex((h) => h.trim() === 'email')

		let emails = []
		if (emailColIndex >= 0) {
			// Multi-column CSV — extract the email column
			emails = lines
				.slice(1)
				.map((line) => line.split(',')[emailColIndex]?.trim())
				.filter(Boolean)
		} else {
			// Single-column or plain list
			emails = lines.map((line) => line.split(',')[0].trim()).filter(Boolean)
		}

		userEmailsText.value = emails.join('\n')
	}
	reader.readAsText(file)
}

// ── Assign resource ────────────────────────────────────────────────────────────
const assignResource = createResource({
	url: 'lms.lms.batch_assignment.assign_users_to_batch',
	onSuccess(data) {
		result.value = data
		if (data.status === 'Success') {
			toast.success(`${data.assigned} ${__('users assigned to batch successfully.')}`)
		} else if (data.status === 'Partial') {
			const failed = data.skipped + (data.errors?.length || 0)
			toast.warning(`${data.assigned} ${__('assigned')}, ${failed} ${__('skipped/failed.')}`)
		} else {
			toast.error(__('Batch assignment failed. Check the error log below.'))
		}
	},
	onError(err) {
		toast.error(err.messages?.join('\n') || __('An unexpected error occurred.'))
	},
})

function submitAssignment() {
	result.value = null
	assignResource.submit({
		batch_name: selectedBatchName.value,
		user_list: JSON.stringify(userList.value),
	})
}

// ── Summary message ────────────────────────────────────────────────────────────
const summaryMessage = computed(() => {
	if (!result.value) return ''
	const { assigned, skipped, errors, status } = result.value
	const errorCount = errors?.length || 0
	if (status === 'Success') {
		return `${assigned} ${__('users enrolled in the batch successfully.')}`
	}
	const parts = []
	if (assigned) parts.push(`${assigned} ${__('enrolled')}`)
	if (skipped) parts.push(`${skipped} ${__('already in batch')}`)
	if (errorCount) parts.push(`${errorCount} ${__('error(s)')}`)
	return parts.join(' · ')
})

// ── Reset ──────────────────────────────────────────────────────────────────────
function reset() {
	selectedBatch.value = ''
	userEmailsText.value = ''
	result.value = null
	if (csvInput.value) csvInput.value.value = ''
}

// ── Page meta ──────────────────────────────────────────────────────────────────
usePageMeta(() => ({
	title: __('Import & Assign Users'),
	icon: brand.favicon,
}))
</script>
