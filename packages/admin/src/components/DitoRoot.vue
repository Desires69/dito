<template lang="pug">
  .dito
    modals-container
    notifications(
      ref="notifications"
      position="top right"
    )
    dito-menu(
      :views="resolvedViews"
    )
    main.dito-page.dito-parent
      dito-header(
        :spinner="options.spinner"
        :isLoading="appState.loadingCounter > 0"
      )
        dito-account(
          v-if="user"
        )
        a.dito-login(
          v-else-if="allowLogin"
          @click="rootComponent.login()"
        )
          span Login
      router-view
</template>

<style lang="sass">
  .dito
    // Import everything name-spaced in .dito
    @import 'dito.sass'
    height: 100%
    display: flex
</style>

<script>
import DitoComponent from '@/DitoComponent'
import DitoUser from '@/DitoUser'
import { processView, resolveViews } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-root', {
  props: {
    views: { type: [Object, Function, Promise], required: true },
    options: { type: Object, default: () => ({}) }
  },

  data() {
    return {
      allowLogin: false,
      resolvedViews: {}
    }
  },

  computed: {
    notifications() {
      return this.$refs.notifications
    }
  },

  created() {
    this.appState.title = document.title || 'Dito.js Admin'
  },

  async mounted() {
    try {
      this.allowLogin = false
      if (await this.fetchUser()) {
        await this.resolveViews()
      } else {
        await this.login()
      }
    } catch (err) {
      console.error(err)
    }
    this.allowLogin = true
  },

  methods: {
    closeNotifications() {
      this.notifications.destroyAll()
    },

    async login() {
      this.allowLogin = true
      const loginData = await this.showDialog({
        components: {
          username: {
            type: 'text',
            autofocus: true
          },
          password: {
            type: 'password'
          }
        },

        buttons: {
          login: {
            type: 'submit',
            events: {
              click({ dialogComponent }) {
                dialogComponent.accept()
              }
            }
          },

          cancel: {
            events: {
              click({ dialogComponent }) {
                dialogComponent.cancel()
              }
            }
          }
        }
      }, {
        width: '480px',
        height: 'auto',
        clickToClose: false
      })
      if (loginData) {
        try {
          const response = await this.api.request({
            method: 'post',
            url: `${this.api.authPath}/login`,
            data: loginData
          })
          this.setUser(response.data.user)
          await this.resolveViews()
        } catch (err) {
          const error = err.response?.data?.error
          if (error) {
            this.notify('error', 'Authentication Error', error)
          } else {
            this.notify('error', 'Authentication Error', err)
            console.error(err, err.response)
          }
          this.login()
        }
      }
    },

    async logout() {
      try {
        const response = await this.api.request({
          method: 'post',
          url: `${this.api.authPath}/logout`
        })
        if (response.data.success) {
          this.setUser(null)
          this.resolvedViews = {}
          this.$router.push({ path: '/' })
        }
      } catch (err) {
        console.error(err)
      }
    },

    async fetchUser() {
      let user = null
      try {
        const response = await this.api.request({
          method: 'get',
          // TODO: Convert to `${this.api.authPath}/session`?
          url: `${this.api.authPath}/session`
        })
        user = response.data.user || null
      } catch (err) {
        console.error(err)
      }
      this.setUser(user)
      return user
    },

    setUser(user) {
      if (user) {
        Object.setPrototypeOf(user, DitoUser.prototype)
      }
      this.appState.user = user
    },

    async ensureUser() {
      try {
        if (!(await this.fetchUser())) {
          await this.login()
        }
      } catch (err) {
        console.error(err)
      }
    },

    async resolveViews() {
      try {
        const views = await resolveViews(this.views)
        // Copy views to convert from module to a plain object:
        this.resolvedViews = { ...views }
      } catch (error) {
        if (!error.request) {
          console.error(error)
        }
        return this.login()
      }
      // Collect all routes from the root schema components
      const routes = []
      const promises = []
      for (const [name, schema] of Object.entries(this.resolvedViews)) {
        promises.push(processView(this.api, schema, name, routes))
      }
      await Promise.all(promises)
      this.$router.addRoutes(routes)
    },

    onBeforeRequest() {
      return this.ensureUser()
    },

    onAfterRequest({ method, url }) {
      // Detect change of the own user, and reload it if necessary.
      if (
        method === 'patch' &&
        url === `${this.api.authPath}/${this.user?.id}`
      ) {
        return this.fetchUser()
      }
    }
  }
})
</script>
