<template>
	<div class="animate-pulse">
		<!-- A full course page: in-header bar + two-column body -->
		<div v-if="variant === 'course-page'" class="p-5">
			<div class="flex justify-between w-full gap-x-8">
				<div class="md:w-2/3 space-y-6">
					<div class="h-8 w-2/3 rounded bg-surface-gray-3" />
					<div class="flex gap-3">
						<div class="h-4 w-24 rounded bg-surface-gray-2" />
						<div class="h-4 w-32 rounded bg-surface-gray-2" />
						<div class="h-4 w-28 rounded bg-surface-gray-2" />
					</div>
					<div class="flex gap-2">
						<div class="h-6 w-16 rounded bg-surface-gray-2" />
						<div class="h-6 w-20 rounded bg-surface-gray-2" />
					</div>
					<div class="space-y-2">
						<div class="h-4 w-full rounded bg-surface-gray-2" />
						<div class="h-4 w-5/6 rounded bg-surface-gray-2" />
					</div>
					<div class="border rounded-md p-4 space-y-3">
						<div
							v-for="i in 5"
							:key="i"
							class="h-5 w-full rounded bg-surface-gray-2"
						/>
					</div>
				</div>
				<div class="hidden md:block w-80 shrink-0 space-y-4">
					<div class="h-44 w-full rounded-md bg-surface-gray-3" />
					<div class="h-9 w-full rounded bg-surface-gray-3" />
					<div
						v-for="i in 4"
						:key="i"
						class="h-4 w-3/4 rounded bg-surface-gray-2"
					/>
				</div>
			</div>
		</div>

		<!-- A form: in-page header + field grid -->
		<div v-else-if="variant === 'form'" class="flex flex-col">
			<div class="flex items-center justify-between border-b px-5 py-3">
				<div class="h-6 w-40 rounded bg-surface-gray-3" />
				<div class="h-8 w-20 rounded bg-surface-gray-3" />
			</div>
			<div class="grid grid-cols-1 md:grid-cols-[1fr,360px] flex-1">
				<div class="px-5 py-5 space-y-5">
					<div v-for="i in 6" :key="i" class="space-y-1.5">
						<div class="h-3 w-24 rounded bg-surface-gray-2" />
						<div class="h-8 w-full rounded bg-surface-gray-2" />
					</div>
				</div>
				<div class="border-s px-4 py-4 space-y-4">
					<div
						v-for="i in 5"
						:key="i"
						class="h-8 w-full rounded bg-surface-gray-2"
					/>
				</div>
			</div>
		</div>

		<!-- A two-pane editor: content + outline -->
		<div
			v-else-if="variant === 'editor'"
			class="grid grid-cols-1 md:grid-cols-[1fr,320px] h-[60vh]"
		>
			<div class="px-6 py-6 space-y-4">
				<div class="h-7 w-1/2 rounded bg-surface-gray-3" />
				<div
					v-for="i in 4"
					:key="i"
					class="h-4 w-full rounded bg-surface-gray-2"
				/>
				<div class="h-48 w-full rounded-md bg-surface-gray-3 mt-4" />
			</div>
			<div class="border-s px-3 py-4 space-y-2">
				<div
					v-for="i in 8"
					:key="i"
					class="h-7 w-full rounded bg-surface-gray-2"
				/>
			</div>
		</div>

		<!-- A LayoutHeader stand-in: matches the sticky header chrome with
			 placeholders for breadcrumbs (left) and the action button strip
			 (right). Mirrors LayoutHeader.vue's spacing so the real header
			 slots in without a layout jump. -->
		<div
			v-else-if="variant === 'header'"
			class="flex items-center justify-between border-b px-3 py-2.5 sm:px-5"
		>
			<div class="flex items-center gap-2">
				<div class="h-4 w-16 rounded bg-surface-gray-2" />
				<div class="h-4 w-1 rounded bg-surface-gray-2" />
				<div class="h-4 w-40 rounded bg-surface-gray-3" />
			</div>
			<div class="flex items-center gap-2">
				<div class="h-8 w-20 rounded bg-surface-gray-2" />
				<div class="h-8 w-24 rounded bg-surface-gray-3" />
			</div>
		</div>

		<!-- A Tabs strip stand-in: row of tab-shaped placeholders sitting on
			 a bottom border, matching the real Tabs strip's height. -->
		<div
			v-else-if="variant === 'tabs'"
			class="flex items-center gap-1 border-b px-3 py-2 sm:px-5"
		>
			<div
				v-for="i in count"
				:key="i"
				class="h-8 w-28 rounded bg-surface-gray-2"
			/>
		</div>

		<!-- Lesson content pane: standalone half of the old `editor` variant,
			 so the editor's content + sidebar can load independently. -->
		<div v-else-if="variant === 'editor-content'" class="px-6 py-6 space-y-4">
			<div class="h-7 w-1/2 rounded bg-surface-gray-3" />
			<div
				v-for="i in 4"
				:key="i"
				class="h-4 w-full rounded bg-surface-gray-2"
			/>
			<div class="h-48 w-full rounded-md bg-surface-gray-3 mt-4" />
		</div>

		<!-- Chapter sidebar: standalone half of the old `editor` variant,
			 used in the editor right pane while the outline loads. -->
		<div v-else-if="variant === 'editor-sidebar'" class="px-3 py-4 space-y-2">
			<div
				v-for="i in 8"
				:key="i"
				class="h-7 w-full rounded bg-surface-gray-2"
			/>
		</div>

		<!-- A list of rows -->
		<div v-else-if="variant === 'list'" class="space-y-2">
			<div
				v-for="i in count"
				:key="i"
				class="h-9 w-full rounded bg-surface-gray-2"
			/>
		</div>

		<!-- Dashboard-style number cards -->
		<div
			v-else-if="variant === 'cards'"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
		>
			<div v-for="i in count" :key="i" class="border rounded-md p-4 space-y-3">
				<div class="h-3 w-1/2 rounded bg-surface-gray-2" />
				<div class="h-7 w-2/3 rounded bg-surface-gray-3" />
			</div>
		</div>

		<!-- Plain text lines -->
		<div v-else class="space-y-2">
			<div
				v-for="i in lines"
				:key="i"
				class="h-4 rounded bg-surface-gray-2"
				:class="i === lines ? 'w-2/3' : 'w-full'"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		variant?:
			| 'course-page'
			| 'form'
			| 'editor'
			| 'header'
			| 'tabs'
			| 'editor-content'
			| 'editor-sidebar'
			| 'list'
			| 'cards'
			| 'lines'
		count?: number
		lines?: number
	}>(),
	{
		variant: 'lines',
		count: 5,
		lines: 3,
	}
)
</script>
