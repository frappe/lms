<template>
    <div v-if="showOtpDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
  <frappe-ui-dialog
    v-if="showOtpDialog"
    title="Verify Your Identity"
    class="w-100 max-w-md max-h-[80vh] overflow-y-auto fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-lg rounded-lg bg-white"
    :close-on-esc="false"
    :close-on-overlay-click="false"
    :show-close-button="false"
    :show-footer="false"
  >
    <form class="p-6" @submit.prevent="submitOtp">
      <p class="text-center mb-4 text-gray-700 font-medium">
        Please Enter otps to continue your Trainning.
      </p>
      <div class="mb-4">
        <label class="block mb-1 font-semibold text-gray-600" for="email-otp">Email OTP</label>
      <input
        id="email-otp"
        v-model="emailOtp"
        type="number"
        placeholder="Enter Email OTP"
        :class="[
  'w-full mb-2 rounded-lg p-2 focus:outline-none focus:ring-2'
]"
      required
      />
      </div>
      <div class="mb-6">
        <label class="block mb-1 font-semibold text-gray-600" for="mobile-otp">Mobile OTP</label>
        <input
          id="mobile-otp"
          v-model="mobileOtp"
          type="number"
          placeholder="Enter Mobile OTP"
          class="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <span  @click="sendOtp" class="block w-fit p-2 ml-auto mb-4 rounded-lg border border-gray-500 cursor-pointer select-none active:ring-2 ring-blue-500">Resend me otps</span>
      <button
      type="submit"
        variant="primary"
        class="w-full font-semibold py-2 cusor-pointer hover:bg-blue-600 bg-blue-500 text-white rounded-lg"
      >
        Submit
      </button>
    </form>
  </frappe-ui-dialog>
</div>
</template>

<script setup>
import { ref } from 'vue'

const showOtpDialog = ref(true)
const emailOtp = ref('')
const mobileOtp = ref('')
const errors = ref({
  emailOtp: "not valid",
  mobileOtp:"npt alid"
})

window.addEventListener("load", () => {
      getUnlockedStatus();
})

function getUnlockedStatus() {
  // Simulate an API call to check if the user is locked
  // Replace this with your actual API call logic
  const userLocked = false; 
  if (userLocked) {
    showOtpDialog.value = true;
    console.log("Page loaded, showing OTP dialog")
  }
}

async function sendOtp(){
  
}

async function submitOtp(){

}
</script>


<style scoped>
   input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
     -webkit-appearance: none;
     margin: 0;
   }

     input[type="number"] {
     -moz-appearance: textfield;
   }

</style>