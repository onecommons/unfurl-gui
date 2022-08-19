let previousTitle

export async function notFoundError(title='The page you were looking for cannot be found (404)') {

    previousTitle = document.title
    document.title = title
    const overlay = document.createElement('div')
    overlay.setAttribute('id', '404-overlay')
    const content = await fetch('/404.html').then(res => res.text())
    overlay.style.backgroundColor = 'white'
    overlay.style.width = '100vw'
    overlay.style.height = '100vh'
    overlay.style.position = 'fixed'
    overlay.style.left = '0'
    overlay.style.top = '0'
    overlay.style.zIndex = '100000'

    document.body.appendChild(overlay)
    const shadow = overlay.attachShadow({mode: 'closed'})
    const body = document.createElement('body')
    shadow.append(body)
    body.innerHTML = content
}

export function removeNotFoundError() {
    const overlay = document.querySelector('#404-oeverlay')
    if(overlay) {
        document.body.removeChild(overlay)
        document.title = previousTitle
    }
}
