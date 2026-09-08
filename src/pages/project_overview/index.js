import '../../assets/standalone-tokens.css'
import '~/locale'
import initProjectOverView from '../../gitlab-oc/project_overview';

if (document.getElementById('js-oc-project-overview')) {
    initProjectOverView();
}
