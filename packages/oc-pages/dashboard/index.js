import Vue from 'vue';
import TableComponentContainer from './components/table.vue';
import apolloProvider from './graphql';
import { GlToast } from '@gitlab/ui';
import store from './store';

Vue.use(GlToast);

export default (elemId='js-table-component') => {
  const element = document.getElementById(elemId);

  return new Vue({
    el: element,
    apolloProvider,
    store,
    render(createElement) {
      return createElement(TableComponentContainer);
    },
  });
};
