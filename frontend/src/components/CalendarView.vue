<template>
  <div class="calendar_wrapper is-light-mode">
    <Qalendar :events="events" :config="props.config || config" />
  </div>
</template>

<script setup>
import { Qalendar } from 'qalendar'

const props = defineProps({
  showMonthlyView: {
    type: Boolean,
  },
  events: {
    type: Array,
    required: true,
  },
  config: {
    type: Object,
  },
})

const config = {
  style: {
    fontFamily: 'inherit',
  },
  dayBoundaries: {
    start: 8,
    end: 22,
  },
}

if (props.showMonthlyView) {
  config.defaultMode = 'month'
  config.disableModes = ['day', 'week']
}
</script>

<style>
//@import 'qalendar/dist/style.css';

.calendar_wrapper {
  width: 100%;
  height: 100%;
  padding: 20px;
}
</style>
