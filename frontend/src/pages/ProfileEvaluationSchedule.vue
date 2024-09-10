<template>
    <div class="mt-7 mb-20">
        <div class="flex h-screen flex-col overflow-hidden">
            <Calendar
                v-if="evaluations.data?.length"
                :config="{
                    defaultMode: 'Month',
                    disableModes: ['Day', 'Week'],
                    redundantCellHeight: 100,
                    enableShortcuts: false,
                }"
                :events="evaluations.data"
                @click="(event) => openEvent(event)"
            >
                <template #header="{currentMonthYear,
                        decrement,
                        increment,
                    }">
                    <div class="mb-2 flex justify-between">
                        <span class="text-lg font-semibold">
                            {{ currentMonthYear }}
                        </span>
                        <div class="flex gap-x-1">
                            <Button
                                @click="decrement()"
                                variant="ghost"
                                class="h-4 w-4"
                                icon="chevron-left"
                            />
                            <Button
                                @click="increment()"
                                variant="ghost"
                                class="h-4 w-4"
                                icon="chevron-right"
                            />
                        </div>
                    </div>
                </template>
            </Calendar>
        </div>
    </div>
    <Event v-model="showEvent" :event="currentEvent"/>
</template>
<script setup>
import { Calendar, createListResource, Button } from "frappe-ui"
import { inject, ref } from "vue"
import Event from "@/components/Modals/Event.vue"

const user = inject("$user")
const currentEvent = ref(null)
const showEvent = ref(false)

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

const evaluations = createListResource({
    doctype: "LMS Certificate Request",
    filters: {
        "evaluator": user.data?.name
    },
    fields: ["name", "member_name", "member", "course", "course_title", "batch_name", "batch_title", "date", "start_time", "end_time", "google_meet_link"],
    auto: true,
    cache: ["schedule", user.data?.name],
    transform(data) {
        return data.map((d) => {
            return {
                title: `${d.member_name}'s Evaluation`,
                participant: d.member_name,
                id: d.name,
                venue: d.google_meet_link,
                fromDate: `${d.date} ${d.start_time}`,
                toDate: `${d.date} ${d.end_time}`,
                color: "green",
                start_time: d.start_time,
                end_time: d.end_time,
                course: d.course,
                course_title: d.course_title,
                member: d.member,
                batch_name: d.batch_name,
                batch_title: d.batch_title
            }
        })
    },
})

const openEvent = (event) => {
    currentEvent.value = event.calendarEvent
    showEvent.value = true
}
</script>