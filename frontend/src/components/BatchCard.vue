<template>
    <div class="border border-gray-200 rounded-md p-4 h-full" style="min-height: 150px;">
        <div class="text-xl font-semibold mb-1">
            {{ batch.title }}
        </div>
        <div class="short-introduction">
            {{ batch.description }}
        </div>
        <div class="mt-auto">
            <div class="flex items-center mb-1">
                <Calendar class="h-4 w-4 stroke-1 mr-2" />
                <span>
                    {{ dayjs(batch.start_date).format("DD MMM YYYY") }} - {{ dayjs(batch.end_date).format("DD MMM YYYY") }}
                </span>
            </div>
            <div class="flex items-center">
                <Clock class="h-4 w-4 stroke-1 mr-2" />
                <span>
                    {{ formatTime(batch.start_time) }} - {{ formatTime(batch.end_time) }}
                </span>
            </div>
        </div>
    </div>
</template>
<script setup>
import { Calendar, Clock } from "lucide-vue-next"
import { inject } from "vue"

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