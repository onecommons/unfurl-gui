
ENDPOINT=$1
#ENDPOINT="https://unfurl.cloud/api/graphql"

GITLAB_SESSION=$2
#GITLAB_SESSION="80f760ebcd8c0d6b5129fc5e4060c4da"

for f in $(ls prepared-graphql-statements/* | sed 's#.*/##'  | sort -n)
do
  statement=prepared-graphql-statements/$f
  curl -g \
    -X POST \
    -H "Content-Type: application/json" \
    -H "cookie: _gitlab_session=$GITLAB_SESSION;" \
    -d @$statement \
    $ENDPOINT
done
