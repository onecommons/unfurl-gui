jest.mock("~/lib/utils/axios_utils", () => jest.fn())

import {GithubImportHandler, oauthStatus, importStatus} from './github-import.js'
import _ from 'lodash'

let importHandler
beforeEach(() => {
    importHandler = new GithubImportHandler(_.cloneDeep(mockData))
})

test('correctly labeled imported project', () => {
    expect(importHandler.getImportStatus('onecommons/unfurl-gui')).toEqual(importStatus.IMPORTED)
})

test('correctly labeled unimported project', () => {
    expect(importHandler.getImportStatus('onecommons/gitlab-oc')).toEqual(importStatus.AVAILABLE)
})

const mockData = {
    "imported_projects": [
        {
            "id": 80,
            "name": "unfurl-gui",
            "full_path": "/user-2022-07-05T20-15-12/unfurl-gui",
            "full_name": "user-2022-07-05T20-15-12 / unfurl-gui",
            "import_source": "onecommons/unfurl-gui",
            "import_status": "finished",
            "human_import_status_name": "finished",
            "provider_link": "https://github.com/onecommons/unfurl-gui"
        }
    ],
    "provider_repos": [
        {
            "id": 18897591,
            "full_name": "onecommons/acttogether",
            "sanitized_name": "acttogether",
            "provider_link": "https://github.com/onecommons/acttogether"
        },
        {
            "id": 20967374,
            "full_name": "onecommons/base",
            "sanitized_name": "base",
            "provider_link": "https://github.com/onecommons/base"
        },
        {
            "id": 20967533,
            "full_name": "onecommons/base-example",
            "sanitized_name": "base-example",
            "provider_link": "https://github.com/onecommons/base-example"
        },
        {
            "id": 25580976,
            "full_name": "onecommons/base-payments",
            "sanitized_name": "base-payments",
            "provider_link": "https://github.com/onecommons/base-payments"
        },
        {
            "id": 410373731,
            "full_name": "onecommons/cloud-dev-ensemble",
            "sanitized_name": "cloud-dev-ensemble",
            "provider_link": "https://github.com/onecommons/cloud-dev-ensemble"
        },
        {
            "id": 105637021,
            "full_name": "onecommons/demos",
            "sanitized_name": "demos",
            "provider_link": "https://github.com/onecommons/demos"
        },
        {
            "id": 439772176,
            "full_name": "onecommons/formily-gitlab-ui",
            "sanitized_name": "formily-gitlab-ui",
            "provider_link": "https://github.com/onecommons/formily-gitlab-ui"
        },
        {
            "id": 410359962,
            "full_name": "onecommons/gitlab-oc",
            "sanitized_name": "gitlab-oc",
            "provider_link": "https://github.com/onecommons/gitlab-oc"
        },
        {
            "id": 105413383,
            "full_name": "onecommons/hosted-sites",
            "sanitized_name": "hosted-sites",
            "provider_link": "https://github.com/onecommons/hosted-sites"
        },
        {
            "id": 95324657,
            "full_name": "onecommons/onecommons.github.io",
            "sanitized_name": "onecommons-github-io",
            "provider_link": "https://github.com/onecommons/onecommons.github.io"
        },
        {
            "id": 120594816,
            "full_name": "onecommons/openshift-ansible",
            "sanitized_name": "openshift-ansible",
            "provider_link": "https://github.com/onecommons/openshift-ansible"
        },
        {
            "id": 120595880,
            "full_name": "onecommons/openshift-ansible-contrib",
            "sanitized_name": "openshift-ansible-contrib",
            "provider_link": "https://github.com/onecommons/openshift-ansible-contrib"
        },
        {
            "id": 98764544,
            "full_name": "onecommons/polyform",
            "sanitized_name": "polyform",
            "provider_link": "https://github.com/onecommons/polyform"
        },
        {
            "id": 420590385,
            "full_name": "onecommons/production-gitlab",
            "sanitized_name": "production-gitlab",
            "provider_link": "https://github.com/onecommons/production-gitlab"
        },
        {
            "id": 420549570,
            "full_name": "onecommons/project-planning",
            "sanitized_name": "project-planning",
            "provider_link": "https://github.com/onecommons/project-planning"
        },
        {
            "id": 193422246,
            "full_name": "onecommons/rhizome",
            "sanitized_name": "rhizome",
            "provider_link": "https://github.com/onecommons/rhizome"
        },
        {
            "id": 496690607,
            "full_name": "onecommons/sourcegraph",
            "sanitized_name": "sourcegraph",
            "provider_link": "https://github.com/onecommons/sourcegraph"
        },
        {
            "id": 232269682,
            "full_name": "onecommons/terraform-test",
            "sanitized_name": "terraform-test",
            "provider_link": "https://github.com/onecommons/terraform-test"
        },
        {
            "id": 186607693,
            "full_name": "onecommons/tosca-parser",
            "sanitized_name": "tosca-parser",
            "provider_link": "https://github.com/onecommons/tosca-parser"
        },
        {
            "id": 132939353,
            "full_name": "onecommons/unfurl",
            "sanitized_name": "unfurl",
            "provider_link": "https://github.com/onecommons/unfurl"
        },
        {
            "id": 339594195,
            "full_name": "onecommons/unfurl-campsite",
            "sanitized_name": "unfurl-campsite",
            "provider_link": "https://github.com/onecommons/unfurl-campsite"
        },
        {
            "id": 339576289,
            "full_name": "onecommons/unfurl-examples",
            "sanitized_name": "unfurl-examples",
            "provider_link": "https://github.com/onecommons/unfurl-examples"
        },
        {
            "id": 304721514,
            "full_name": "onecommons/unfurl-gui",
            "sanitized_name": "unfurl-gui",
            "provider_link": "https://github.com/onecommons/unfurl-gui"
        },
        {
            "id": 410371598,
            "full_name": "onecommons/unfurl-starter",
            "sanitized_name": "unfurl-starter",
            "provider_link": "https://github.com/onecommons/unfurl-starter"
        },
        {
            "id": 285674784,
            "full_name": "onecommons/unfurl_site",
            "sanitized_name": "unfurl_site",
            "provider_link": "https://github.com/onecommons/unfurl_site"
        },
        {
            "id": 1385936,
            "full_name": "onecommons/vesper",
            "sanitized_name": "vesper",
            "provider_link": "https://github.com/onecommons/vesper"
        },
        {
            "id": 121594266,
            "full_name": "onecommons/vision",
            "sanitized_name": "vision",
            "provider_link": "https://github.com/onecommons/vision"
        },
        {
            "id": 466295526,
            "full_name": "onecommons/www.unfurl.cloud",
            "sanitized_name": "www-unfurl-cloud",
            "provider_link": "https://github.com/onecommons/www.unfurl.cloud"
        }
    ],
    "incompatible_repos": []
}
