import Vue from 'vue';
import TableComponentContainer from './components/table.vue';
import apolloProvider from './graphql';
import { GlToast } from '@gitlab/ui';

Vue.use(GlToast);

export default () => {
  const element = document.getElementById('js-table-component');

  return new Vue({
    el: element,
    apolloProvider,
    render(createElement) {
      return createElement(TableComponentContainer);
    },
  });
};
