// The fields oc-pages reads from `window.gon`. The fork fills it from Rails
// (`Gitlab::GonHelper` plus oc/ additions); standalone fills it in unfurl's
// server/templates/skeleton.j2.html. Only fields both sides may set belong here.
interface Gon {
  /** true only in standalone `unfurl serve --gui`; absent in the fork */
  unfurl_gui?: boolean;
  /** path of the dashboard project; standalone uses a `local:` path or null */
  home_project?: string | null;
  working_dir_project?: string;
  gitlab_url?: string;
  relative_url_root?: string;
  unfurl_server_url?: string;
  current_username?: string;
  current_user_fullname?: string;
  projectId?: number | string;
  environmentId?: number | string;
}

interface Window {
  gon: Gon;
}
