<template>
    <div class="h-screen">
        <header
            class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
        >
            <Breadcrumbs class="h-7" :items="[{ label: __('All Batches'), route: { name: 'Batches' } }]"/>
            <div class="flex">
                <Button variant="solid">
                    <template #prefix>
                        <Plus class="h-4 w-4" />
                    </template>
                    {{ __("New Batch") }}
                </Button>
            </div>
        </header>
        <div class="mx-5 my-10">
            <div class="grid grid-cols-3 gap-8 mt-5">
                <BatchCard v-for="batch in batches.data" :batch="batch" />
            </div>
        </div>
    </div>
</template>
<script setup>
import { createResource, Breadcrumbs } from "frappe-ui";
import { Plus } from "lucide-vue-next"
import BatchCard from '@/components/BatchCard.vue';

const batches = createResource({
    url: "lms.lms.utils.get_batches",
    cache: ["batches"],
    auto: true,
});
console.log(batches)
</script>