<template>
	<div class="flex flex-col h-full min-h-0 text-base">
		<header class="flex items-start justify-between p-8">
			<div class="flex flex-col gap-1 max-w-3xl">
				<!-- Back button sits in the left gutter, vertically centered on the
				     title line (Helpdesk pattern) so it reads as part of the heading
				     while the title/description stay left-aligned. -->
				<div class="relative flex items-center gap-2">
					<Button
						v-if="showBack"
						variant="ghost"
						:aria-label="__('Go back')"
						icon="lucide-chevron-left"
						class="shrink-0"
						@click="emit('back')"
					/>
					<h2 class="text-p-3xl-semibold text-ink-gray-9">
						{{ title }}
					</h2>
					<slot name="title-badge" />
				</div>
				<p v-if="description" class="text-p-base text-ink-gray-6 max-w-2xl">
					{{ description }}
				</p>
			</div>
			<div
				v-if="$slots['header-actions']"
				class="flex items-center gap-2 shrink-0"
			>
				<slot name="header-actions" />
			</div>
		</header>

		<div v-if="$slots['header-bottom']" class="px-8">
			<slot name="header-bottom" />
		</div>

		<!-- Scroll container owns the horizontal padding so focus rings on
		     controls aren't clipped at the scroll edge (CRM SettingsLayoutBase
		     pattern). overflow-y:auto forces overflow-x to clip, so flush
		     controls need this breathing room. -->
		<div class="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'

defineProps<{
	title: string
	description?: string
	showBack?: boolean
}>()

const emit = defineEmits<{ back: [] }>()
</script>
