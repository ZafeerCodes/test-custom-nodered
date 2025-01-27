let baseerBuilderInfluxConfigs = {
  url: process.env.BASEER_BUILDER_INFLUX_URL || "",
  token: process.env.BASEER_BUILDER_INFLUX_TOKEN,
  org: process.env.BASEER_BUILDER_INFLUX_ORG,
  bucket: process.env.BASEER_BUILDER_INFLUX_BUCKET,
  username: process.env.BASEER_BUILDER_INFLUX_USERNAME,
  password: process.env.BASEER_BUILDER_INFLUX_PASSWORD,
};
let baseerBuilderPostgreSQLConfigs = {
  user: process.env.BASEER_BUILDER_PG_USERNAME,
  type: process.env.BASEER_BUILDER_PG_TYPE,
  host: process.env.BASEER_BUILDER_PG_HOST,
  database: process.env.BASEER_BUILDER_PG_DATABASE,
  password: process.env.BASEER_BUILDER_PG_PASSWORD,
  port: process.env.BASEER_BUILDER_PG_PORT,
};

module.exports = {
  baseerBuilderPostgreSQLConfigs,
  baseerBuilderInfluxConfigs,
};
