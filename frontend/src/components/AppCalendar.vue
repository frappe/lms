<template>
  <div class="p-5 h-full">
    <!-- actions buttons for calendar -->

    <!-- left side  -->
    <!-- Year, Month & Current Program and Dropdown -->
    <!-- right side -->
    <!-- Increment and Decrement Button, View change button default is months or can be set via props! -->

    <div class="flex justify-between mb-2">
      <span class="text-xl font-medium">
        {{ getMonth() + ', ' + currentYear }}</span
      >
      <div class="flex gap-x-1">
        <!-- <button class="border-2 border-green-500 p-2">Previous</button> -->
        <Button
          @click="decrementMonth"
          variant="ghost"
          class="h-4 w-4"
          icon="chevron-left"
        />
        <Button
          @click="incrementMonth"
          variant="ghost"
          class="h-4 w-4"
          icon="chevron-right"
        />
      </div>
    </div>

    <div class="h-[92%] min-h-[600px] min-w-[600px]">
      <!-- Day List -->
      <div class="grid grid-cols-7 w-full pb-2">
        <span
          v-for="day in daysList"
          class="text-center text-gray-600 font-normal text-sm"
          >{{ day }}</span
        >
      </div>

      <!-- Date Grid -->
      <div
        class="grid grid-cols-7 border-t-[1px] border-l-[1px] h-full w-full grid-rows-6"
      >
        <div
          v-for="date in currentMonthDates"
          class="border-r-[1px] border-b-[1px] border-gray-200"
        >
          <div
            class="flex justify-center h-full font-normal mx-2"
            :class="currentMonthDate(date) ? 'text-gray-500' : 'text-gray-200'"
          >
            <div
              v-if="currentMonthDate(date)"
              class="relative flex flex-col items-center w-full overflow-y-auto"
            >
              <span
                class="py-1 sticky top-0 bg-white w-full text-center z-10"
                :class="
                  date.toDateString() === new Date().toDateString() &&
                  'font-bold'
                "
              >
                {{ date.getDate() }}
              </span>

              <div class="w-full">
<!--                <CalendarEvent-->
<!--                  v-for="calendarEvent in parsedData[parseDate(date)]"-->
<!--                  :event="calendarEvent"-->
<!--                  :date="date"-->
<!--                  class="mb-2 cursor-pointer w-full"-->
<!--                  :draggable="false"-->
<!--                  :key="calendarEvent.name"-->
<!--                />-->
              </div>
            </div>
            <span v-else>{{
              shortMonthList[date.getMonth()] + ' ' + date.getDate()
            }}</span>
          </div>
        </div>
      </div>
      <!-- <div class=" w-20 h-20 bg-orange-400 absolute top-[212px] left">

			</div> -->
    </div>
  </div>
</template>
<script setup>
import {getCalendarDates, groupBy} from '../utils/calendar'
import { computed, ref } from 'vue'
import CalendarEvent from './CalendarEvent.vue'
import {  Button } from 'frappe-ui'


const props = defineProps({
  events: {
    type: Object,
    required: false,
  },
})

let currentMonth = ref(new Date().getMonth())
let currentYear = ref(new Date().getFullYear())

let monthList = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

let shortMonthList = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

let daysList = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

let currentMonthDates = computed(() => {
  let allDates = getCalendarDates(currentMonth.value, currentYear.value)
  return allDates
})

let parsedData = computed(() => groupBy(props.events, (row) => row.date))

function parseDate(date) {
	console.log(date)
  let dd = date?.getDate()
  let mm = date?.getMonth() + 1
  let yyyy = date?.getFullYear()

  if (dd < 10) dd = '0' + dd
  if (mm < 10) mm = '0' + mm

  return `${yyyy}-${mm}-${dd}`
}

function getMonth() {
  return monthList[currentMonth.value]
}

function incrementMonth() {
  currentMonth.value++
  if (currentMonth.value > 11) {
    currentMonth.value = 0
    currentYear.value++
  }
}

function decrementMonth() {
  currentMonth.value--
  if (currentMonth.value < 0) {
    currentMonth.value = 11
    currentYear.value--
  }
}

function currentMonthDate(date) {
  return date.getMonth() === currentMonth.value
}
</script>

<style></style>
