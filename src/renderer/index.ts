import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'


new Vue({
  render: h => h(App),
  vuetify: vuetify,
}).$mount('#app')