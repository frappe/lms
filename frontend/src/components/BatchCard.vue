<template>
    <div class="shadow rounded-md p-4 h-full" style="min-height: 150px;">
        <div class="text-xl font-semibold mb-1">
            {{ batch.title }}
        </div>
        <div class="short-introduction">
            {{ batch.description }}
        </div>
        <div class="mt-auto">
            <div class="flex items-center mb-1">
                <Calendar class="h-4 w-4 stroke-1 mr-2" />
                {{ dayjs(batch.start_date).format("DD MMM YYYY") }} - {{ dayjs(batch.end_date).format("DD MMM YYYY") }}
            </div>
            <div class="flex items-center">
                <Clock class="h-4 w-4 stroke-1 mr-2" />
                {{ batch.start_time }} - {{ batch.end_time }}
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