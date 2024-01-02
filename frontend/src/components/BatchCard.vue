<template>
    <div class="flex flex-col border border-gray-200 rounded-md p-4 h-full" style="min-height: 150px;">
        <Badge v-if="batch.seat_count && batch.seats_left > 0" theme="green" class="self-start mb-2">
            {{ batch.seats_left }} {{ __("Seat Left") }}
        </Badge>
        <Badge v-else-if="batch.seat_count && batch.seats_left <= 0" theme="red" class="self-start mb-2">
            {{ __("Sold Out") }}
        </Badge>
        <div class="text-xl font-semibold mb-1">
            {{ batch.title }}
        </div>
        <div class="short-introduction">
            {{ batch.description }}
        </div>
        <div class="mt-auto">
            <div v-if="batch.amount" class="font-semibold text-lg mb-4">
                {{ batch.price }}
            </div>
            <div class="flex items-center mb-3">
                <BookOpen class="h-4 w-4 stroke-1.5 mr-2 text-gray-700"/>
                <span>
                    {{ batch.courses }} {{ __("Courses") }}
                </span>
            </div>
            <div class="flex items-center mb-3">
                <Calendar class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
                <span>
                    {{ dayjs(batch.start_date).format("DD MMM YYYY") }} - {{ dayjs(batch.end_date).format("DD MMM YYYY") }}
                </span>
            </div>
            <div class="flex items-center">
                <Clock class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
                <span>
                    {{ formatTime(batch.start_time) }} - {{ formatTime(batch.end_time) }}
                </span>
            </div>
        </div>
    </div>
</template>
<script setup>
import { Calendar, Clock, BookOpen } from "lucide-vue-next"
import { inject } from "vue"
import { Badge } from "frappe-ui"

const dayjs = inject("$dayjs")
const props = defineProps({
    batch: {
        type: Object,
        default: null,
    },
});

function formatTime(timeString) {
    if (!timeString) return "";
    const [hour, minute] = timeString.split(":").map(Number);

    // Create a Date object with dummy values for day, month, and year
    const dummyDate = new Date(0, 0, 0, hour, minute);

    // Use Intl.DateTimeFormat to format the time in 12-hour format
    const formattedTime = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    }).format(dummyDate);

    return formattedTime;
}
</script>
<style>
.short-introduction {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	text-overflow: ellipsis;
	width: 100%;
	overflow: hidden;
	margin: 0.25rem 0 1.25rem;
    line-height: 1.5;
}
</style>