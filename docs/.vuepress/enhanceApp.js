import pageComponents from '@internal/page-components'
import '@gitlab/ui/dist/index.css'
import '@gitlab/ui/dist/utility_classes.css'

export default ({ Vue }) => {
  for (const [name, component] of Object.entries(pageComponents)) {
    Vue.component(name, component)
  }
}
