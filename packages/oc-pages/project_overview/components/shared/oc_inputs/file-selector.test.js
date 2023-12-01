import FileSelector from './file-selector.vue'
import { createLocalVue, shallowMount } from '@vue/test-utils'
import Vuex from 'vuex'


const localVue = createLocalVue()
localVue.use(Vuex)

const HOME_PROJECT_PATH = 'jest/dashboard'
const CURRENT_ENVIRONMENT_NAME = 'gcp'
const CURRENT_PROJECT_PATH = 'onecommons/blueprints/nextcloud'
const DEPLOYMENT_NAME = 'baserow-azure-1'
const ENSEMBLE_DIR = `environments/${CURRENT_ENVIRONMENT_NAME}/${CURRENT_PROJECT_PATH}/${DEPLOYMENT_NAME}`

const store = new  Vuex.Store({
  getters: {
    getHomeProjectPath() {
      return HOME_PROJECT_PATH
    },
    getCurrentEnvironmentName() {
      return CURRENT_ENVIRONMENT_NAME
    },
    getCurrentProjectPath() {
      return CURRENT_PROJECT_PATH
    },
    getDeploymentTemplate() {
      return {name: DEPLOYMENT_NAME}
    }
  }
})

function evalGetdir(loc) {
  return {
    eval: {
      get_dir: [{input: loc}]
    }
  }
}

function evalAbs(rel, loc='spec') {
  return {
    eval: {
      abspath: [{input: rel}, {input: loc}]
    }
  }
}

const baseSchema = {
  "title": "RSA Public Key",
  "default": "",
  "required": true,
  "user_settable": true,
  "sensitive": true,
  "input_type": "file",
  "type": "string"
}

// schemas have most likely been changed by unfurl-gui before reaching this input
const testCases = {
  'default values': {
    props: {
      schema: baseSchema,
      value: ""
    },
    expected: {
      mimeTypes: [],
      directoriesAllowed: true,
      fileRepository: HOME_PROJECT_PATH,
      schemaDefaultLocation: '.',
      schemaDefaultPrefix: ENSEMBLE_DIR
    }
  },

  'get_dir [spec]': {
    props: {
      schema: {
        ...baseSchema,
        default: evalGetdir('spec')
      },
      value: evalGetdir('spec')
    },
    expected: {
      mimeTypes: ['directory'],
      directoriesAllowed: true,
      fileRepository: CURRENT_PROJECT_PATH,
      schemaDefaultLocation: 'spec',
      schemaDefaultPrefix: ''
    }
  },

  'abspath [/, spec]': {
    props: {
      schema: {
        ...baseSchema,
        default: evalAbs('/')
      },
      value: evalAbs('/')
    },
    expected: {
      mimeTypes: ['directory'],
      directoriesAllowed: true,
      fileRepository: CURRENT_PROJECT_PATH,
      schemaDefaultLocation: 'spec',
      schemaDefaultPrefix: ''
    }

  },

  'abspath [README, spec]': {
    props: {
      schema: {
        ...baseSchema,
        default: evalAbs('README.md')
      },
      value: evalAbs('README.md')
    },
    expected: {
      mimeTypes: ['text/markdown'],
      directoriesAllowed: false,
      fileRepository: CURRENT_PROJECT_PATH,
      schemaDefaultLocation: 'spec',
      schemaDefaultPrefix: ''
    }

  },

  'get_dir [project]': {
    props: {
      schema: {
        ...baseSchema,
        default: evalAbs('README.md', 'project')
      },
      value: evalAbs('README.md', 'project')
    },
    expected: {
      mimeTypes: ['text/markdown'],
      directoriesAllowed: false,
      fileRepository: HOME_PROJECT_PATH,
      schemaDefaultLocation: 'project',
      schemaDefaultPrefix: '',
    }

  },

  'explicit file types': {
    props: {
      schema: {
        ...baseSchema,
        default: evalAbs('README.md', 'project'),
        file_types: ['.mp3', '.mp4']
      },
      value: evalAbs('README.md', 'project')
    },
    expected: {
      mimeTypes: ['audio/mpeg', 'video/mp4'],
    }

  },

  'select /README.md': {
    props: {
      schema: {
        ...baseSchema,
        default: evalGetdir('spec')
      },
      value: evalGetdir('spec')
    },
    select: "//README.md",
    output: {
      eval: {
        abspath: [
          'README.md',
          'spec'
        ]
      }
    }
  },

  'select <ensemble-dir>/README.md': {
    props: {
      schema: {
        ...baseSchema,
        default: evalGetdir('.')
      },
      value: evalGetdir('.')
    },
    select: `${ENSEMBLE_DIR}/README.md`,
    output: {
      eval: {
        abspath: [
          'README.md',
          '.'
        ]
      }
    }
  },

}

describe('file selector component', () => {
  Object.entries(testCases).forEach(([caseName, caseData]) => {
    it(caseName, async () => {
      const {expected, props, select, output} = caseData

      const wrapper = shallowMount(FileSelector, {
        localVue,
        store,
        propsData: props,
      })

      const vm = wrapper.vm

      if(expected) {
        Object.entries(expected).forEach(([name, value]) => {
          expect(vm).toHaveProperty(name, value)
        })
      }

      if(select) {
        vm.handleSelect(select, true)
        await vm.$nextTick()
        vm.confirm()
        await vm.$nextTick()
        expect(wrapper.emitted().change[0][0]).toEqual(output)
      }
    })

  })
})
