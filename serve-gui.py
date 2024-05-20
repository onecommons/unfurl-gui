#!/usr/bin/env python3
import os
from pathlib import Path
from unfurl.server import app
import unfurl.server as ufserver
from flask import request, Response, Request, jsonify, send_file
from jinja2 import Environment, FileSystemLoader
import requests
import re
from glob import glob


WEBPACK_ORIGIN = os.environ.get('WEBPACK_ORIGIN') # implied dev mode
DIST = os.path.join(os.path.dirname(os.path.realpath(__file__)), "dist")
PUBLIC = os.path.join(os.path.dirname(os.path.realpath(__file__)), "public")

env = Environment(loader=FileSystemLoader(
    os.path.join(os.path.dirname(os.path.realpath(__file__)), 'templates')
))
blueprint_template = env.get_template('project.j2.html')
dashboard_template = env.get_template('dashboard.j2.html')
readme = None

for filename in ['README', 'README.md', 'README.txt']:
    if os.path.exists(filename):
        with open(filename, 'r') as file:
            readme = file.read()
        break

err, localenv = ufserver._make_readonly_localenv("", "")
user = os.getenv('USER', 'unfurl-user')


def get_head_contents(f):
    with open(f, 'r') as file:
        contents = file.read()
        return re.search(r'<head.*?>(.*?)</head>', contents, re.DOTALL).group(1)
        

if WEBPACK_ORIGIN:
    project_head = f"""
    <head>
      {get_head_contents(os.path.join(PUBLIC, "index.html"))}

      <script defer src="/js/chunk-vendors.js"></script>
      <script defer src="/js/chunk-common.js"></script>
      <script defer src="/js/project.js"></script>
    </head>
    """

    dashboard_head = f"""
    <head>
      {get_head_contents(os.path.join(PUBLIC, "index.html"))}

      <script defer src="/js/chunk-vendors.js"></script>
      <script defer src="/js/chunk-common.js"></script>
      <script defer src="/js/dashboard.js"></script>
    </head>

    """
else:
    project_head = f"<head>{get_head_contents(os.path.join(DIST, 'project.html'))}</head>"
    dashboard_head = f"<head>{get_head_contents(os.path.join(DIST, 'dashboard.html'))}</head>"


def serve_document():
    format = 'environments'
    if Path('ensemble-template.yaml').exists():
        format = 'blueprint'

    project_name = localenv.project.name


    if format == 'blueprint':
        template = blueprint_template
    else:
        template = dashboard_template

    return template.render(
        name=project_name,
        readme=readme,
        user=user,
        head=(project_head if format == 'blueprint' else dashboard_head)
    )


def proxy_webpack(url):
    res = requests.request(  # ref. https://stackoverflow.com/a/36601467/248616
        method          = request.method,
        url             = url,
        headers         = {k:v for k,v in request.headers if k.lower() != 'host'}, # exclude 'host' header
        data            = request.get_data(),
        cookies         = request.cookies,
        allow_redirects = False,
    )

    #region exlcude some keys in :res response
    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']  #NOTE we here exclude all "hop-by-hop headers" defined by RFC 2616 section 13.5.1 ref. https://www.rfc-editor.org/rfc/rfc2616#section-13.5.1
    headers          = [
        (k,v) for k,v in res.raw.headers.items()
        if k.lower() not in excluded_headers
    ]
    #endregion exlcude some keys in :res response

    return Response(res.content, res.status_code, headers)


def create_gui_routes():
    @app.route('/<user>/dashboard/-/variables')
    def variables(user):
        return {"variables": []}


    @app.route(f'/api/v4/projects/{localenv.project.name}/repository/branches')
    def branches():
        repo = ufserver._get_project_repo("", "", {})

        return jsonify(
            #TODO 
            [{"name": repo.active_branch, "commit": {"id": repo.revision}}]
        )


    @app.route('/<path:project_path>/-/raw/<branch>/<path:file>')
    def local_file(project_path, branch, file):
        path_prefix = os.path.join('repos', 'public', project_path)

        # TODO don't match arbitrary globs
        matches = glob(f'{path_prefix}/*/{file}')

        if len(matches) > 0:
            return send_file(os.path.abspath(matches[0]))

        return "Not found", 404


    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_webpack(path):
        # if path == '':
            # path = 'dashboard'
        if 'text/html' in request.headers['accept']: 
            return serve_document()


        if WEBPACK_ORIGIN:
            url = f"{WEBPACK_ORIGIN}/{path}"
        else:
            url = path


        qs = request.query_string.decode('utf-8')
        if qs != '':
            url += '?' + qs


        if request.headers['sec-fetch-dest'] == 'iframe':
            return "Not found", 404

        if WEBPACK_ORIGIN:
            return proxy_webpack(url)
        else:
            return send_file(os.path.join(DIST, path))


if __name__ == '__main__':
    from unfurl.__main__ import cli
    create_gui_routes()
    import sys
    cli(args=['serve', *sys.argv[1:]])
