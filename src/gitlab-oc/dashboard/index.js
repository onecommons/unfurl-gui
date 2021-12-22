import Vue from 'vue';
import TableComponent from './components/table.vue';
import apolloProvider from './graphql';

export default () => {
  const element = document.getElementById('js-table-component');

  return new Vue({
    el: element,
    apolloProvider,
    render(createElement) {
      return createElement(TableComponent);
    },
  });
};
