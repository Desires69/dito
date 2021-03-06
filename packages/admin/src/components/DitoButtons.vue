<template lang="pug">
  .dito-buttons
    // NOTE: This is similar to DitoComponents, but uses the DitoButtonContainer
    // sub-class as the component container for different layout:
    .dito-buttons-container.dito-schema-content
      dito-button-container(
        v-for="(buttonSchema, buttonDataPath) in buttonSchemas"
        v-if="shouldRender(buttonSchema)"
        :key="buttonDataPath"
        :schema="buttonSchema"
        :dataPath="buttonDataPath"
        :data="data"
        :meta="meta"
        :store="getChildStore(buttonSchema.name)"
        :disabled="disabled"
        :generateLabels="false"
      )
</template>

<style lang="sass">
.dito
  .dito-buttons-container
    display: flex
    flex-flow: row wrap
    flex: 100%
    align-items: baseline
    justify-content: center
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { appendDataPath } from '@/utils/data'

// @vue/component
export default DitoComponent.component('dito-buttons', {
  inject: ['$validator'],

  provide: {
    tabComponent: null
  },

  props: {
    buttons: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false }
  },

  computed: {
    buttonSchemas() {
      // Compute a buttons list which has the dataPath baked into its keys.
      const { dataPath, buttons } = this
      return Object.values(buttons || {}).reduce((schemas, button) => {
        schemas[appendDataPath(dataPath, button.name)] = button
        return schemas
      }, {})
    }
  }
})
</script>
