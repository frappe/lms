<template>
	<!-- The shell under every page header: a name, a filter strip, the content
	     and a footer. Four slots, nothing else. A page says what goes in them
	     and this owns how they read at each breakpoint, so a spacing fix lands
	     on all of them at once.

	     On a desk `min-h-0` is what lets the content inside own the scroll box
	     instead of growing the page: a flex child otherwise refuses to shrink
	     below its content, so the page grows and takes the header with it out of
	     view.

	     A phone must not do that. A scroll box nested inside the page means the
	     page itself has no scroll range, and a browser only retracts its URL bar
	     when the root scroller moves, so the bottom of the viewport stays
	     unreachable however far you swipe. Below `sm` this grows with its content
	     instead and MobileLayout's #scrollContainer does the scrolling. -->
	<div class="flex flex-1 flex-col sm:min-h-0">
		<div class="flex flex-1 flex-col sm:min-h-0 sm:overflow-y-auto">
			<!-- The name and filters scroll with the content, at every width: they
			     belong to the page rather than to the chrome, and holding them
			     still spends a third of a phone screen on controls the reader has
			     already used. Only the app header above and the footer below stay
			     put.

			     Pinning this would also be the old bug back: PageHeader is `sticky
			     top-0` in the same scroller, so a second `sticky top-0` lands
			     underneath it and loses its first 49px, and the offset that would
			     clear it is the app header's own content height: the measurement
			     that drifted and opened a band. It gets a rule on a phone instead,
			     where it runs the full width and the content begins under it. -->
			<div
				v-if="hasNameStrip"
				class="mb-5 flex shrink-0 flex-col justify-between gap-4 border-b px-5 pb-4 pt-5 sm:border-b-0 sm:pb-0 md:flex-row md:items-center"
			>
				<h1 v-if="hasName" class="text-lg-semibold min-w-0 text-ink-gray-9">
					<slot name="name">{{ title }}</slot>
				</h1>
				<!-- Gap and width belong to the strip, not to the page: every filter
				     is one column wide and they wrap rather than squeeze, so a page
				     can drop in a search box, a dropdown and a toggle and get a row
				     that lines up. A control with an intrinsic width (a segmented
				     tab bar, a chip) opts out with `!w-fit`; the bang is needed
				     because a child selector always outranks a class on the child. -->
				<div
					v-if="$slots.filters"
					class="flex flex-wrap items-center gap-3 [&>*]:w-full sm:[&>*]:w-44"
				>
					<slot name="filters" />
				</div>
			</div>

			<slot />
		</div>

		<!-- Sits under the content, which scrolls behind it, rather than at the
		     end of it: the page size and Load More are how you work a long list,
		     so they stay put while you do. On a desk being the last flex child of
		     a bounded column is enough, and shrink-0 stops long content squeezing
		     it away.

		     On a phone it takes both. `sticky` holds it once the content overflows
		     and scrolls under it; `mt-auto` puts it on the bottom edge when it
		     does not, because short content leaves the column with slack that
		     nothing else claims and the strip would otherwise stop wherever the
		     content happened to end. The raised surface is the Espresso token for
		     something content scrolls beneath. -->
		<div
			v-if="$slots.footer"
			class="sticky bottom-0 z-10 mt-auto shrink-0 bg-surface-elevation-1 sm:static sm:mt-0"
		>
			<slot name="footer" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(defineProps<{ title?: string }>(), { title: '' })

const slots = useSlots()

const hasName = computed<boolean>(() => Boolean(slots.name || props.title))

const hasNameStrip = computed<boolean>(() =>
	Boolean(hasName.value || slots.filters)
)
</script>
