<template>
    <div class="shadow rounded-md">
        <div>
            {{ batch.title }}
        </div>
        <div>
            {{ batch.description }}
        </div>
        <div>
            <Calendar class="h-4 w-4 stroke-1" />
            {{ batch.start_date }} - {{ batch.end_date }}
        </div>
        <div>
            <Clock class="h-4 w-4 stroke-1" />
            {{ batch.start_time }} - {{ batch.end_time }}
        </div>
    </div>
</template>
<script setup>
import { Calendar, Clock } from "lucide-vue-next"
const props = defineProps({
    batch: {
        type: Object,
        default: null,
    },
});
</script>