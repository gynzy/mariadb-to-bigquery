# mariadb-to-mysql
Data Transfer from MariaDB to BigQuery

## Install

```
$ cd app && npm i
```

## Usage on localhost
Copy the `.env.example` to `.env` and fill in the desired configuration. 

OR set following values instead.

```
export QUERY_LIMIT=100000
export RDS_HOST=xxxxxxxx
export RDS_USER=xxxxxxxx
export RDS_PASSWORD=xxxxxxxx
export RDS_DATABASE=xxxxxxxx
export BQ_PROJECT_ID=xxxxxxxx
export GCE_JSON=xxxxxx
export BQ_DATASET=xxxxxxxx
export TABLES=Komma,Separated,List,Of,Tables,To,Copy
```

## Usage with docker
- pass the environment variables in `.env` to the container
- mount the `google-keyfile.json` in the docker container in `/app`

## License
MIT
