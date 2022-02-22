<template>
  <v-app>
    <span>{{ message }}</span>
  </v-app>
</template>

<script lang="ts">
import { ipcRenderer } from "electron";

export default {
  name: "App",
  data() {
    return {
      message: "Welcome to Your Vue.js App",
    };
  },
  mounted() {
    ipcRenderer.invoke("start");
    ipcRenderer.on("key", (event, arg) => {
      console.log(arg);
    });
    console.log("I sent start!");
  },
};
</script>

<style></style>
