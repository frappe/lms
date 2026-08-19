<template>
	<SettingsRowGroup
		v-for="group in groups"
		:key="group.key"
		:label="group.label ? __(group.label) : undefined"
	>
		<SettingsRow
			v-for="row in group.rows"
			:key="row.key"
			:label="__(row.label)"
			:icon="row.icon"
			:description="row.description"
			:value="row.value"
			:href="safeUrl(row.href)"
			:navigates="Boolean(row.to || row.action)"
			:chevron="Boolean(row.to || row.href)"
			@click="activate(row)"
		>
			<template v-if="row.selected" #control>
				<span
					data-testid="row-selected"
					class="lucide-check size-4.5 shrink-0 text-ink-gray-8"
				/>
			</template>
		</SettingsRow>
	</SettingsRowGroup>
</template>

<script setup lang="ts">
// The only component that knows how a settings row is drawn. Screens hand it
// `groups` — plain objects — and never write a row themselves.
//
// A row either navigates (`to`, drawn with a chevron) or reports a choice
// (`action`, drawn with a check when selected). Routing is done here so a
// screen does not repeat the push; a choice is emitted upward because only the
// screen knows what picking it means.
//
// A row with an `href` goes somewhere this router cannot — an admin's Contact
// Us URL, a page Frappe serves itself. It is not handled here at all: SettingsRow
// draws it as a real <a> and the browser follows it, so there is no push to
// make and no click to emit.
import { useRouter } from 'vue-router'
import { safeUrl } from '@/utils/safeUrl'
import SettingsRow from '@/components/Settings/Mobile/SettingsRow.vue'
import SettingsRowGroup from '@/components/Settings/Mobile/SettingsRowGroup.vue'
import type {
	MobileRow,
	MobileRowGroup,
} from '@/components/Settings/mobileSettings'

defineProps<{ groups: MobileRowGroup[] }>()

const emit = defineEmits<{ action: [value: string] }>()

const router = useRouter()

const activate = (row: MobileRow): void => {
	if (row.to) router.push(row.to)
	else if (row.action) emit('action', row.action)
}
</script>
