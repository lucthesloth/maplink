import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import VueSweetalert2 from 'vue-sweetalert2';

new Vue({
  render: h => h(App),
  vuetify: vuetify,
}).$mount('#app')

Vue.use(VueSweetalert2)