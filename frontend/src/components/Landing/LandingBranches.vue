<template>
	<section
		v-if="branches.length"
		id="branches"
		class="relative z-[1] mx-auto max-w-6xl scroll-mt-24 px-4 py-14"
	>
		<h2 class="lp-section-title">{{ __('Our branches') }}</h2>
		<div class="mt-8 grid gap-5 md:grid-cols-3">
			<article
				v-for="branch in branches"
				:key="branch.label + branch.name"
				class="lp-card p-6"
			>
				<p class="lp-eyebrow">{{ branch.label }}</p>
				<h3 v-if="branch.name" class="mt-3 text-lg font-medium">
					{{ branch.name }}
				</h3>
				<p v-if="branch.address" class="lp-muted mt-2 text-sm">
					{{ branch.address }}
				</p>
				<p v-if="branch.phone" class="mt-4 font-medium text-[var(--lp-title)]">
					{{ __('Phone') }}: {{ branch.phone }}
				</p>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { LandingContent } from '@/pages/Landing/content'

defineProps<{ branches: LandingContent['branches'] }>()
</script>
