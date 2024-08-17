import { defineStore } from 'pinia'

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    unreadCount: 0
  }),
  actions: {
    setUnreadCount(count) {
      this.unreadCount = count
    },
    decrementUnreadCount() {
      if (this.unreadCount > 0) {
        this.unreadCount--
      }
    },
    resetUnreadCount() {
      this.unreadCount = 0
    }
  }
})
