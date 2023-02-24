import {
    OcPropertiesList,
    StatusIcon,
    ProjectIcon,
    Status,
    DeploymentResources,
    OcTab,
    GitHubRepos,
    ErrorSmall,
    EmptyStateJob,
    EnvironmentSelection,
    DeploymentScheduler,
    IncrementalDeploymentSwitch,
    LocalDeploy,
    CodeClipboard,
    CiVariableSettings,
    SignIn,
    PageNotFound,
    UnfurlGuiErrors,
    ExperimentalSettingsIndicator
} from './index'

export const OcComponents = {
    install(app, options) {
        app.component('oc-properties-list', OcPropertiesList)
        app.component('oc-status-icon', StatusIcon)
        app.component('oc-project-icon', ProjectIcon)
        app.component('oc-status', Status)
        app.component('oc-deployment-resources', DeploymentResources)
        app.component('oc-tab', OcTab)
        app.component('oc-github-repos', GitHubRepos)
        app.component('oc-error-small', ErrorSmall)
        app.component('oc-empty-state-job', EmptyStateJob)
        app.component('oc-environment-selection', EnvironmentSelection)
        app.component('oc-deployment-scheduler', DeploymentScheduler)
        app.component('oc-incremental-deployment-switch', IncrementalDeploymentSwitch)
        app.component('oc-local-deploy', LocalDeploy)
        app.component('oc-code-clipboard', CodeClipboard)
        app.component('oc-ci-variable-settings', CiVariableSettings)
        app.component('oc-sign-in', SignIn)
        app.component('oc-404', PageNotFound)
        app.component('oc-unfurl-gui-errors', UnfurlGuiErrors)
        app.component('oc-experimental-settings-indicator', ExperimentalSettingsIndicator)
    }
}
