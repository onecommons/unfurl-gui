import '../../assets/standalone-base.css'
import '~/locale'
import initTableComponent from 'oc_dashboard';

if (document.getElementById('js-table-component')) {
    initTableComponent();
}
