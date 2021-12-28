import Vue from 'vue';
import TableComponentContainer from './components/table.vue';
import apolloProvider from './graphql';

export default () => {
  const element = document.getElementById('js-table-component');

  return new Vue({
    el: element,
    apolloProvider,
    render(createElement) {
      return createElement('div');
    },
  });
};
