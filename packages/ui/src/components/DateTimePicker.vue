<template lang="pug">
  .dito-date-time-picker(
    ref="picker"
  )
    .dito-pickers(
      :class="{ 'dito-focus': showDate || showTime }"
    )
      date-picker(
        ref="date"
        v-model="currentValue"
        placement="bottom-left"
        :target="$refs.picker"
        :show.sync="showDate"
        v-on="$listeners"
        v-bind="{ transition, placeholder, format, locale, disabled }"
      )
      time-picker(
        ref="time"
        v-model="currentValue"
        placeholder=""
        placement="bottom-right"
        :target="$refs.picker"
        :show.sync="showTime"
        v-on="$listeners"
        v-bind="{ transition, disabled }"
      )
</template>

<style lang="sass">
  .dito-date-time-picker
    // display: inline-block
    .dito-pickers
      @extend %input
      padding: 0
      display: flex
      .dito-input
        background: none
        border: 0
    .dito-date-picker
      width: 60%
      min-width: 6.9em
      .dito-input
        padding-right: 0
    .dito-time-picker
      width: 40%
      min-width: 5.4em
      .dito-input
        padding-left: 0
        text-align: right
</style>

<script>
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'

export default {
  components: { DatePicker, TimePicker },

  props: {
    value: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placeholder: { type: String, default: null },
    format: { type: String, default: 'yyyy-MM-dd' },
    locale: { type: String, default: 'en-US' },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return {
      currentValue: this.value,
      showDate: false,
      showTime: false
    }
  },

  watch: {
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.currentValue = newVal
      }
    },

    currentValue(date) {
      if (+date !== +this.value) {
        this.$emit('input', date)
      }
    }
  },

  methods: {
    focus() {
      this.$refs.date.focus()
    },

    blur() {
      this.$refs.date.blur()
      this.$refs.time.blur()
    }
  }
}

</script>
