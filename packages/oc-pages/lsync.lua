sync {
  default.rsyncssh,
  source=os.getenv('PWD'),
  targetdir="/home/andrew/onecommons/gitlab-oc/oc/app/assets/javascripts",
  host="skelaware.abreidenbach.com",
  exclude = {"package.json", "lsync.lua"},
  delay = 1,
  delete = false,
  rsync = {
    archive = true,
    compress = true
  }
}
