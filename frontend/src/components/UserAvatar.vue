<template>
    <Avatar class="avatar border border-gray-300" v-if="user" :label="user.full_name" :image="user.user_image" size="lg" v-bind="$attrs" />
</template>
<script setup>
import { Avatar } from 'frappe-ui'
const props = defineProps({
    user: {
        type: Object,
        default: null,
    },
});
</script>
