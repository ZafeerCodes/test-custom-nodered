const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });
var _ = require("lodash");
const {
  baseerBuilderInfluxConfigs,
  baseerBuilderPostgreSQLConfigs,
} = require("./configs/dbConfig");
const {
  initializeInfluxDBClient,
  processInfluxWrite,
} = require("./configs/influxV2");
const {
  connectToPostgreDatabase,
  processPostgrePayloads,
  handleDatabaseClose,
  initializePostgreSQLDBClient,
} = require("./configs/postgreSql");
const { getField } = require("../helpers/common");

module.exports = function (RED) {
  "use strict";
  const VERSION_20 = "2.0";

  function databaseNode(n) {
    RED.nodes.createNode(this, n);

    this.influxdbConfig = RED.nodes.getNode(n.influxDatabaseConfigs);
    this.postgredbConfig = RED.nodes.getNode(n.postgreDatabaseConfigs);
    this.postgreDatabaseConfig = RED.nodes.getNode(n.postgreDatabase);
    this.postgreTableConfig = RED.nodes.getNode(n.postgreTable);
    this.precision = n.precision;
    this.retentionPolicy = n.retentionPolicy;

    // Influx v2.0
    this.precisionV18FluxV20 = n.precisionV18FluxV20;
    this.retentionPolicyV18Flux = n.retentionPolicyV18Flux;
    this.influxOrg = n.influxOrg;
    this.influxBucket = RED.nodes.getNode(n.influxBucket)?.bucketName;
    this.influxMeasurment = RED.nodes.getNode(n.influxMeasurment)?.measurementName;

    //Extras
    this.payloadKeys = n.payloadKeys || [];
    var node = this;
    node.on("input", async function (msg, send, done) {
      try {
        if (n.databaseType === "influxdb") {
          this.influxdbConfig = this.influxdbConfig || {};
          this.credentials = this.credentials || {};
          if (n.databaseServer === "baseer-builder") {
            this.influxdbConfig.org = baseerBuilderInfluxConfigs.org;
            this.influxdbConfig.bucket = this.influxBucket || baseerBuilderInfluxConfigs.bucket;
            this.influxdbConfig.measurement = this.influxMeasurment || "";
            this.influxdbConfig.rejectUnauthorized = true;
            this.influxdbConfig.connectionTimeout = 100;
            this.influxdbConfig.url = baseerBuilderInfluxConfigs.url;
            this.influxdbConfig.influxdbVersion = VERSION_20;
            this.credentials.username = baseerBuilderInfluxConfigs.username;
            this.credentials.password = baseerBuilderInfluxConfigs.password;
            this.credentials.token = baseerBuilderInfluxConfigs.token;
          } else {
            this.influxdbConfig.org = this.influxOrg || "";
            this.influxdbConfig.bucket = this.influxBucket || "";
            this.influxdbConfig.measurement = this.influxMeasurment || "";
          }
          if (!this.influxdbConfig.client) {
            this.influxdbConfig.client = initializeInfluxDBClient(
              this.influxdbConfig,
              this.credentials
            );
          }
          try {
            await processInfluxWrite(
              this.influxdbConfig,
              msg,
              this.influxdbConfig.measurement,
              this.precisionV18FluxV20,
              this.payloadKeys,
              node,
              done
            );
          } catch (error) {
            console.log("Error writing influx", error);
          }

        } else if (n.databaseType === "postgresql") {
          try {
            this.postgredbConfig = this.postgredbConfig || {};
            this.credentials = this.credentials || {};
            if (n.databaseServer === "baseer-builder") {
              this.postgredbConfig.hostname =
                baseerBuilderPostgreSQLConfigs.host;
              this.postgredbConfig.port = baseerBuilderPostgreSQLConfigs.port;
              this.postgredbConfig.database =
                this.postgreDatabaseConfig.database ||
                baseerBuilderPostgreSQLConfigs.database ||
                "";
              this.postgredbConfig.table =
                this.postgreTableConfig.tableName || "";
              this.credentials.username = baseerBuilderPostgreSQLConfigs.user;
              this.credentials.password =
                baseerBuilderPostgreSQLConfigs.password;
            } else {
              this.postgredbConfig.database = this.postgreDatabaseConfig.database || "";
              this.postgredbConfig.table = this.postgreTableConfig.tableName || "";
            }

            if (!this.postgredbConfig.client) {
              this.postgredbConfig.client = initializePostgreSQLDBClient(
                this.postgredbConfig,
                this.credentials
              );
              connectToPostgreDatabase(this.postgredbConfig.client, node);
            }

            await processPostgrePayloads(
              this.postgredbConfig.client,
              msg,
              this.postgredbConfig.table,
              this.payloadKeys,
              node,
              done
            );
            done();
          } catch (err) {
            console.error("Error writing to PostgreSQL:", err);
            done(err);
          }
        }
      } catch (error) {
        console.error("Error processing input:", error);
        done(error);
      }
    });
  }
  RED.nodes.registerType("database", databaseNode);
};
