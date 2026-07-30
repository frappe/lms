<template>
	<!-- The shell every list page puts under its header.

	     On a desk `min-h-0` is what lets the rows inside own the scroll box
	     instead of growing the page: a flex child otherwise refuses to shrink
	     below its content, so the page grows and takes the header with it out
	     of view.

	     A phone must not do that. A scroll box nested inside the page means the
	     page itself has no scroll range, and a browser only retracts its URL
	     bar when the root scroller moves — so the bottom of the viewport stays
	     unreachable however far you swipe. Below `sm` this grows with its
	     content instead and MobileLayout's #scrollContainer does the scrolling;
	     the header and footer hold their place with `sticky`, which needs no
	     measuring and cannot drift. -->
	<div class="flex flex-1 flex-col sm:min-h-0">
		<!-- The title and filters scroll with the rows, at every width: they
		     belong to the list, and a page that holds them still spends a third
		     of a phone screen on controls the reader has already used. Only the
		     app header above and the footer below stay put. -->
		<div class="flex flex-1 flex-col sm:min-h-0 sm:overflow-y-auto">
			<slot />
		</div>
		<!-- Sits under the rows, which scroll behind it, rather than at the end
		     of them: the page size and Load More are how you work a long list,
		     so they stay put while you do. On a desk being the last flex child
		     of a bounded column is enough, and shrink-0 stops a long list
		     squeezing it away.

		     On a phone it takes both. `sticky` holds it once the rows overflow
		     and scroll under it; `mt-auto` puts it on the bottom edge when they
		     do not, because a short list leaves the column with slack that
		     nothing else claims and the strip would otherwise stop wherever the
		     last row happened to end. The raised surface is the Espresso token
		     for something content scrolls beneath, the one ListHeader uses where
		     MappingListTable pins it. -->

		<div
			v-if="$slots.footer"
			class="sticky bottom-0 z-10 mt-auto shrink-0 bg-surface-elevation-1 sm:static sm:mt-0"
		>
			<slot name="footer" />
		</div>
	</div>
</template>
