<template>
	<section
		id="contact"
		class="relative z-[1] mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 pt-6"
	>
		<div class="lp-card grid gap-8 p-6 md:grid-cols-2 md:items-center md:p-12">
			<div class="min-w-0">
				<h2 class="lp-section-title">{{ __('Join us today') }}</h2>
				<p class="lp-muted mt-3">
					{{
						__(
							'Call or message us on WhatsApp to ask about batches and courses.',
						)
					}}
				</p>
			</div>
			<div class="grid min-w-0 gap-3">
				<div
					v-if="contact.phone"
					class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--lp-surface-deep)] p-4"
				>
					<div>
						<p class="lp-muted text-xs">{{ __('Call or WhatsApp') }}</p>
						<p
							id="phone-number"
							class="select-all text-lg font-medium tabular-nums text-[var(--lp-title)]"
						>
							{{ contact.phone }}
						</p>
					</div>
					<button type="button" class="lp-btn-secondary" @click="copyPhone">
						{{ copyLabel }}
					</button>
				</div>
				<div
					v-if="contact.website"
					class="rounded-lg bg-[var(--lp-surface-deep)] p-4"
				>
					<p class="lp-muted text-xs">{{ __('Website') }}</p>
					<a
						:href="contact.website"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-[var(--lp-accent)] underline"
						>{{ contact.website }}</a
					>
				</div>
				<div
					v-if="contact.email"
					class="rounded-lg bg-[var(--lp-surface-deep)] p-4"
				>
					<p class="lp-muted text-xs">{{ __('Email') }}</p>
					<p class="font-medium text-[var(--lp-title)]">{{ contact.email }}</p>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { LandingContent } from '@/pages/Landing/content'

const props = defineProps<{ contact: LandingContent['contact'] }>()
const copyLabel = ref(__('Copy'))

function selectNumber() {
	const node = document.getElementById('phone-number')
	if (!node) return
	const range = document.createRange()
	range.selectNodeContents(node)
	const selection = window.getSelection()
	selection?.removeAllRanges()
	selection?.addRange(range)
}

function fallback() {
	selectNumber()
	copyLabel.value = __('Ctrl+C')
}

function copyPhone() {
	// Inside the click handler, so the browser accepts the copy.
	if (!navigator.clipboard?.writeText) return fallback()
	navigator.clipboard.writeText(props.contact.phone).then(
		() => {
			copyLabel.value = __('Copied')
			setTimeout(() => (copyLabel.value = __('Copy')), 1800)
		},
		() => fallback(),
	)
}
</script>
