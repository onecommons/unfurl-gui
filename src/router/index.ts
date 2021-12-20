import Vue from "vue";
import Router from "vue-router";
import Home from "../views/HomeView.vue";
import TableView from "../views/TableView.vue";

Vue.use(Router);

export default new Router({
  mode: "history",
  routes: [
    {
      path: "/home",
      component: Home,
      name: "Home",
      meta: {
        title: "Home"
      }
    },
    {
      path: "/table",
      component: TableView,
      name: "Table",
      meta: {
        title: "Home"
      }
    }
  ]
});
