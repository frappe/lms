<template>
	<div class="mt-7 mb-20 flex flex-col gap-12">
		<section data-testid="availability">
			<div class="flex items-center justify-between gap-4">
				<h2 class="text-lg font-semibold text-ink-gray-9">
					{{ __('Availability') }}
				</h2>
				<div v-if="canEdit && details" class="flex items-center gap-2">
					<Button
						v-if="dirty"
						variant="outline"
						:disabled="saving"
						@click="discard"
					>
						<span class="text-p-base">{{ __('Discard') }}</span>
					</Button>
					<Button
						variant="solid"
						:disabled="!dirty"
						:loading="saving"
						@click="save"
					>
						<span class="text-p-base">{{ __('Save') }}</span>
					</Button>
				</div>
			</div>
			<p
				v-if="readOnlyMode && isSessionUser"
				class="mt-3 text-p-sm text-ink-gray-6"
			>
				{{
					__("You can't change your availability while the site is updating.")
				}}
			</p>
			<ErrorMessage v-if="saveError" class="mt-3" :message="saveError" />

			<ProfileEvaluatorHours
				v-model:week="week"
				:can-edit="canEdit"
				:timezone="details?.timezone"
				:loading="loadingWeek"
				:load-error="loadError"
				:retrying="evaluator.loading"
				:empty="showEmptyWeek"
				:errors="errors"
				@retry="retryLoad"
				@start-week="startingWeek = true"
			/>

			<div
				v-if="details && hasHours"
				class="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
				data-testid="time-off"
			>
				<div class="min-w-0">
					<h3 class="text-base font-semibold text-ink-gray-9">
						<label for="time-off">{{ __('Time off') }}</label>
					</h3>
					<p class="mt-1 text-p-sm text-ink-gray-6">
						{{ timeOffDescription }}
					</p>
				</div>
				<DateRangePicker
					id="time-off"
					v-model="timeOff"
					class="w-full sm:w-64"
					variant="outline"
					format="MMM D YYYY"
					:placeholder="canEdit ? __('Select dates') : __('No time off')"
					:disabled="!canEdit"
				>
					<template #suffix="{ open, setOpen }">
						<button
							v-if="canEdit && timeOff.length"
							type="button"
							class="lucide-x size-4 cursor-pointer text-ink-gray-6 hover:text-ink-gray-8"
							:aria-label="__('Clear time off')"
							@mousedown.prevent
							@click="timeOff = []"
						/>
						<span
							v-else
							class="lucide-chevron-down size-4 cursor-pointer"
							@mousedown.prevent="setOpen(!open)"
						/>
					</template>
				</DateRangePicker>
			</div>
		</section>

		<ProfileEvaluatorCalendar
			v-if="showCalendar"
			:details="details"
			:dirty="dirty"
			@changed="setCalendar"
		/>
	</div>
</template>
<script setup lang="ts">
// Slots are bare wall-clock times read as system time everywhere downstream,
// so the editor names the clock. Edits stay local until Save.
import {
	Button,
	createResource,
	DateRangePicker,
	ErrorMessage,
	toast,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EvaluatorDetails, Resource, SessionUser } from '@/types/api'
import ProfileEvaluatorCalendar from '@/components/Profile/ProfileEvaluatorCalendar.vue'
import ProfileEvaluatorHours from '@/components/Profile/ProfileEvaluatorHours.vue'
import { resourceErrorMessage } from '@/utils/resource'
import {
	WEEKDAYS,
	emptyWeek,
	rangeErrors,
	toRows,
	toTimeOff,
	toWeek,
} from '@/utils/evaluatorAvailability'
import type { TimeOff, Week, Weekday } from '@/utils/evaluatorAvailability'

interface ProfileData {
	name?: string
	username?: string
}

const props = defineProps<{ profile: { data: ProfileData | null } }>()

const user = inject<SessionUser>('$user')
const route = useRoute()
const router = useRouter()
const readOnlyMode = Boolean(window.read_only_mode)

const isSessionUser = computed(
	() =>
		Boolean(props.profile.data?.username) &&
		user?.data?.username === props.profile.data?.username
)
const canEdit = computed(() => isSessionUser.value && !readOnlyMode)
const showCalendar = computed(() => isSessionUser.value && !readOnlyMode)

const evaluator = createResource({
	url: 'lms.lms.api.get_evaluator_details',
	params: { evaluator: props.profile.data?.name },
	auto: true,
	onError(err: unknown) {
		toast.error(resourceErrorMessage(err))
	},
}) as Resource<EvaluatorDetails | null>

const details = computed(() => evaluator.data)

const week = ref<Week>(emptyWeek())
const timeOff = ref<TimeOff>([])
const baseline = ref('')
const startingWeek = ref(false)
const saving = ref(false)
const saveError = ref('')

const snapshot = (): string =>
	JSON.stringify({
		rows: toRows(week.value),
		timeOff: timeOff.value,
	})

const load = (data: EvaluatorDetails | null) => {
	week.value = toWeek(data?.slots?.schedule ?? [])
	timeOff.value = toTimeOff(data?.slots)
	baseline.value = snapshot()
	startingWeek.value = false
	saveError.value = ''
}

// Watches slots alone: a calendar change patches the details and must keep
// unsaved hours.
watch(
	() => evaluator.data?.slots,
	() => load(evaluator.data),
	{
		immediate: true,
	}
)

const dirty = computed(() => snapshot() !== baseline.value)

const hasHours = computed(() =>
	WEEKDAYS.some((day) => week.value[day].length > 0)
)

const loadingWeek = computed(() => !details.value && !evaluator.error)
// Without the saved week, editing would start from seven empty days and
// Save would replace the real one with it.
const loadError = computed(() => !details.value && Boolean(evaluator.error))
// onError has already shown the failure.
const retryLoad = () => evaluator.reload().catch(() => {})

// Seven empty rows read as a broken list, so a week with nothing saved
// starts as an empty state until the evaluator chooses to add hours.
const showEmptyWeek = computed(
	() => Boolean(details.value) && !hasHours.value && !startingWeek.value
)

const errors = computed(
	() =>
		Object.fromEntries(
			WEEKDAYS.map((day) => [day, rangeErrors(week.value[day])])
		) as Record<Weekday, Record<number, string>>
)

const hasErrors = computed(() =>
	WEEKDAYS.some((day) => Object.keys(errors.value[day]).length > 0)
)

const timeOffDescription = computed(() =>
	isSessionUser.value
		? __("Learners can't book you during time off.")
		: __("Learners can't book this evaluator during time off.")
)

const discard = () => load(evaluator.data)

const saveAvailability = createResource({
	url: 'lms.lms.api.save_evaluator_availability',
}) as Resource<EvaluatorDetails>

const save = async () => {
	if (hasErrors.value || !details.value) return
	saving.value = true
	saveError.value = ''
	// The time off row is hidden with no hours, so it saves as none.
	const [from, to] = hasHours.value ? timeOff.value : []
	try {
		const saved = await saveAvailability.submit({
			schedule: toRows(week.value),
			unavailable_from: from ?? null,
			unavailable_to: to ?? null,
		})
		evaluator.setData(saved)
		toast.success(__('Availability saved'))
	} catch (err) {
		saveError.value = resourceErrorMessage(err)
	} finally {
		saving.value = false
	}
}

const setCalendar = (calendar: EvaluatorDetails['calendar']) => {
	if (evaluator.data) evaluator.setData({ ...evaluator.data, calendar })
}

onMounted(() => {
	// Google sends the evaluator back here; a failed sign-in says so in the URL.
	if (route.query.calendar === 'failed') {
		toast.error(
			__('Google did not finish connecting your calendar. Try again.')
		)
		router.replace({ query: { ...route.query, calendar: undefined } })
	}
})
</script>
