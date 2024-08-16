<template>
    <div class="text-base p-4">
        <div class="font-semibold mb-1">
            {{ __(label) }}
        </div>
        <div class="text-xs text-gray-600">
            {{ __(description) }}
        </div>
        <div class="my-4">
            <div v-for="member in members.data" class="grid grid-cols-5 grid-flow-row py-2">
                <div class="flex items-center space-x-2 col-span-2">
                    <Avatar :image="member.user_image" :label="member.full_name" size="sm" />
                    <div>
                       {{ member.full_name }}
                    </div>
                </div>
                <div class="text-sm text-gray-700 col-span-2">
                    {{ member.name }}
                </div>
                <div class="text-sm text-gray-700 justify-self-end">
                    {{ getRole(member.role) }}
                </div>
            </div>
        </div>
        <div v-if="members.hasNextPage" class="flex justify-center">
                <Button variant="solid" @click="members.next">
                    <template #prefix>
                        <component
                            :is="icons['RefreshCw']"
                            class="h-3 w-3 stroke-1.5"
                        />
                    </template>
                    {{ __('Load More') }}
                </Button>
            </div>
    </div>
</template>
<script setup lang="ts">
import { createListResource, Avatar, Button, FormControl } from 'frappe-ui'
import * as icons from 'lucide-vue-next'
import { computed } from "vue"

const props = defineProps({
    label: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
})

const members = createListResource({
    url: "lms.lms.api.get_members",
    doctype: "User",
    auto: true,
})

const getRole = (role) => {
   const map = {
       'LMS Student': 'Student',
       'Course Creator': 'Course Instructor',
       'Moderator': 'Moderator',
       'Batch Evaluator': 'Evaluator'
   }
   return map[role]
}

</script>