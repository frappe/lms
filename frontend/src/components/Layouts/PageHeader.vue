<template>
	<SkeletonLoader v-if="loading" variant="header" />
	<header
		v-else
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-base px-5 py-2.5"
	>
		<div class="flex min-h-9 min-w-0 flex-1 items-center gap-2 sm:min-h-0">
			<!-- A trail plus a badge does not fit 390px beside the actions, so a
			     phone gets a single back link carrying the current page's title.
			     `min-w-0` on the link and `truncate` on the text: without both, a
			     long title pushes the actions off the end instead of shortening.

			     The destination is the parent crumb's route, never `router.back()`.
			     History-back drops a deep-linked or externally referred visitor
			     outside the app entirely, and cannot name where it is going.

			     `text-lg-medium` is the token frappe-ui's own Breadcrumbs uses, so
			     the title reads at one size across the breakpoint rather than
			     shrinking on a phone. Not `text-p-*`: that carries paragraph
			     leading (1.5), and this is inline UI. -->
			<router-link
				v-if="isMobile && backTo"
				:to="backTo"
				class="flex min-w-0 items-center gap-1 text-ink-gray-9"
			>
				<span class="lucide-chevron-left size-4 shrink-0" />
				<span class="truncate text-lg-medium">{{ currentLabel }}</span>
			</router-link>
			<span
				v-else-if="isMobile"
				class="min-w-0 truncate text-lg-medium text-ink-gray-9"
			>
				{{ currentLabel }}
			</span>
			<template v-else>
				<Breadcrumbs class="h-7 min-w-0" :items="breadcrumbs" />
				<Badge v-if="published" theme="green">{{ __('Published') }}</Badge>
			</template>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<slot name="actions" />
		</div>
	</header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Badge, Breadcrumbs } from 'frappe-ui'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useScreenSize } from '@/utils/composables'
import type { Breadcrumb } from '@/types'

const props = withDefaults(
	defineProps<{
		breadcrumbs: Breadcrumb[]
		published?: boolean
		loading?: boolean
	}>(),
	{ published: false, loading: false }
)

const { isMobile } = useScreenSize()

const currentLabel = computed<string>(
	() => props.breadcrumbs[props.breadcrumbs.length - 1]?.label ?? ''
)

const backTo = computed<RouteLocationRaw | null>(
	() => props.breadcrumbs[props.breadcrumbs.length - 2]?.route ?? null
)
</script>
