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
export BQ_DATASET=xxxxxxxx
export TABLES=Comma,Separated,List,Of,Tables,To,Copy
```

Then put a Google service account json file in `/app/google-keyfile.json`. 

From the `/app` folder start the ETL.
```
$ npm start
```

## Usage with docker
- `docker pull quay.io/gynzy/mariadb-to-bigquery:latest` [![Docker Repository on Quay](https://quay.io/repository/gynzy/mariadb-to-bigquery/status "Docker Repository on Quay")](https://quay.io/repository/gynzy/mariadb-to-bigquery)
- pass the environment variables in `.env` to the container
- and as an extra, pass `GCE_JSON` environment variable which should contain a base64 encoded service account (json)

## Usage with Kubernetes
- [Example](kubernetes/job.yaml)

## License
MIT
