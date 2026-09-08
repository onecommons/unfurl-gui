import '../../assets/standalone-base.css'
import '~/locale'
import initProjectOverView from '../../gitlab-oc/project_overview';

if (document.getElementById('js-oc-project-overview')) {
    initProjectOverView();
}
