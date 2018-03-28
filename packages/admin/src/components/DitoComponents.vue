<template lang="pug">
  ul.dito-components(
    v-if="components"
  )
    slot(name="header")
    li.dito-container(
      v-for="(compSchema, compDataPath) in components"
      v-if="include(compSchema)"
      v-show="isVisible(compSchema)"
      :style="getStyle(compSchema)"
      :key="compDataPath"
    )
      dito-label(
        v-if="hasLabel(compSchema)"
        :dataPath="compDataPath"
        :text="getLabel(compSchema)"
      )
      component.dito-component(
        :is="getTypeComponent(compSchema.type)"
        :schema="compSchema"
        :dataPath="compDataPath"
        :data="data"
        :meta="meta"
        :store="getChildStore(compSchema.name)"
        :disabled="isDisabled(compSchema)"
        :class="{ \
          'dito-disabled': isDisabled(compSchema), \
          'dito-fill': hasFill(compSchema), \
          'dito-fixed': isFixed(compSchema), \
          'dito-has-errors': $errors.has(compDataPath) \
        }"
      )
      dito-errors(
        v-if="$errors.has(compDataPath)"
        :dataPath="compDataPath"
      )
</template>

<style lang="sass">
.dito
  .dito-components
    display: flex
    flex-flow: row wrap
    position: relative
    align-items: baseline
    margin: (-$form-spacing) (-$form-spacing-half)
    &::after
      // Use a pseudo element to display a ruler with proper margins
      display: 'block'
      content: ''
      width: 100%
      padding-bottom: $form-margin
      border-bottom: $border-style
      // Add removed $form-spacing again to the ruler
      margin: 0 $form-spacing-half $form-margin
    .dito-container
      flex: 1 1 auto
      align-self: stretch
      box-sizing: border-box
      // Cannot use margin here as it needs to be part of box-sizing for
      // percentages in flex-basis to work.
      padding: $form-spacing $form-spacing-half
  .dito-component.dito-fill
    display: block
    width: 100%
    &.dito-checkbox,
    &.dito-radio-button
      // WebKit doesn't like changed width on checkboxes and radios, override:
      display: inline-block
      width: auto
  .dito-list
    .dito-components
      &::after
        // Hide the ruler in nested forms
        display: none
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { pick } from '@ditojs/utils'

export default DitoComponent.component('dito-components', {
  inject: ['$validator'],

  props: {
    tab: { type: String },
    schema: { type: Object },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true }
  },

  computed: {
    components() {
      // Compute a components list which has the dataPath baked into its keys
      // and adds the key as the name to each component, used for labels, etc.
      const {
        dataPath,
        // NOTE: schema can be null while multi-form lists load their data.
        schema = {}
      } = this
      const components = {}
      for (const [name, component] of Object.entries(schema.components || {})) {
        components[dataPath ? `${dataPath}/${name}` : name] = {
          name,
          ...component
        }
      }
      return components
    }
  },

  methods: {
    include(schema) {
      return pick(this.getSchemaValue('if', true, schema), true)
    },

    isVisible(schema) {
      return pick(this.getSchemaValue('visible', true, schema), true)
    },

    isDisabled(schema) {
      return this.disabled ||
        pick(this.getSchemaValue('disabled', true, schema), false)
    },

    hasLabel(schema) {
      return (schema.label || this.generateLabels) && schema.label !== false
    },

    hasFill(schema) {
      return this.getPercentage(schema) > 0 || schema.width === 'fill'
    },

    isFixed(schema) {
      return schema.width === 'fixed'
    },

    getPercentage(schema) {
      const { width } = schema
      // 'auto' = no fitting:
      return ['auto', 'fixed', 'fill'].includes(width) ? null
        : !width ? 100 // default = 100%
        : /%/.test(width) ? parseFloat(width) // percentage
        : width * 100 // fraction
    },

    getStyle(schema) {
      const percentage = this.getPercentage(schema)
      const fixed = this.isFixed(schema)
      return {
        'flex-basis': percentage && `${percentage}%`,
        'flex-grow': fixed && 0
      }
    },

    focus() {
      if (this.tab) {
        this.$router.push({ hash: this.tab })
      }
    }
  }
})
</script>