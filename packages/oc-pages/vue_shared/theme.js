const stylesheets = [
  'autocomplete.css',
  'container.css',
  'form.css',
  'dialog.css',
  'dropdown.css',
  'dropdown-item.css',
  'dropdown-menu.css',
  'element-variables.css',
  'form-item.css',
  'input.css',
  'card.css',
  'input-number.css',
  'option.css',
  'option-group.css',
  'popover.css',
  'popper.css',
  'radio-button.css',
  'radio.css',
  'radio-group.css',
  'row.css',
  'select.css',
  'select-dropdown.css',
  'slider.css',
  'spinner.css',
  'step.css',
  'steps.css',
  'submenu.css',
  'time-picker.css',
  'time-select.css',
  'tooltip.css',
  'upload.css',
  'loading.css',
]


export async function setupTheme(app) {
  if(document.querySelector('body.gl-dark')) {
    await import('element-ui/lib/theme-chalk/index.css')
    for(const stylesheet of stylesheets) {
      import(`element-theme-dark/lib/${stylesheet}`)
    }
    function addDark(el) {
      el.classList?.add('gl-dark')

    }
    app.mixin({
      watch: {
        $el() {
          addDark(this.$el)
        }
      },
      mounted() {
        addDark(this.$el)
      }
    })
  } else {
    import('element-ui/lib/theme-chalk/index.css')
  }
}
