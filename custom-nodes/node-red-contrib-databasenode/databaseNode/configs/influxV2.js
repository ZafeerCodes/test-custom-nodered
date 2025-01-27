var { InfluxDB, Point } = require("@influxdata/influxdb-client");
const { addFieldsToPoint } = require("../../helpers/common");
const { mapPayloads } = require("../../helpers/payloadMapping");
const VERSION_18_FLUX = "1.8-flux";
const VERSION_20 = "2.0";

function initializeInfluxDBClient(config, credentials) {
  const timeout = Math.floor(+(config.connectionTimeout || 10) * 1000); // convert from seconds to milliseconds
  const token =
    config.influxdbVersion === VERSION_18_FLUX
      ? `${credentials.username}:${credentials.password}`
      : credentials.token;

  return new InfluxDB({
    url: config.url,
    token,
    timeout,
    rejectUnauthorized: config.rejectUnauthorized,
  });
}


async function writePointsToInflux(client, msg, measurement, org, bucket, precision, payloadKeys, node, mainMsg) {
  const writeApi = client.getWriteApi(org, bucket, precision);

  try {
    let { keys, tags } = await mapPayloads(msg, payloadKeys, msg.node, node, mainMsg);
    keys = keys || {};
    tags = tags || {};

    const payload = {
      fields: {
        ...keys
      },
      tags: {
        ...tags
      },
      timestamp: new Date()
    };

    // This console statement is required for debug!
    console.log("Measurement", measurement, "Payload:", payload);

    const point = new Point(measurement);
    const fields = payload?.fields;
    const payloadTags = payload?.tags;
    if (fields && Object.keys(fields).length > 0) {
      addFieldsToPoint(point, fields);
    } else {
      console.warn("Fields are empty, skipping fields addition.");
      node.error("At least one field should be provided.");
    }
    if (payloadTags) {
      for (const prop in payloadTags) {
        point.tag(prop, payloadTags[prop]);
      }
    }
    if (payload.timestamp) {
      point.timestamp(payload.timestamp);
    }
    writeApi.writePoint(point);
    await writeApi.flush(true);

    console.log("Data successfully written to InfluxDB");
  } catch (error) {
    console.error("Error writing points to InfluxDB:", error.message);
  }
}

async function processPayload(msg, payloadKeys) {
  const processedResults = [];

  function createBaseMessage(msg, currentArrayKey) {
    const baseMsg = { ...msg };

    payloadKeys.forEach(key => {
      if (key.keyType.startsWith('array_') && key.keyName.split('.')[0] !== currentArrayKey) {
        baseMsg[key.keyName.split('.')[0]] = null;
      }
      if (key.keyType === 'object' && key.keyName.split('.')[0] !== currentArrayKey) {
        baseMsg[key.keyName.split('.')[0]] = null;
      }
    });

    return baseMsg;
  }

  const uniqueKeys = {
    arrays: new Set(
      payloadKeys
        .filter(key => key.keyType.startsWith('array_'))
        .map(key => key.keyName.split('.')[0])
    ),
    objects: new Set(
      payloadKeys
        .filter(key => key.keyType === 'object')
        .map(key => key.keyName.split('.')[0])
    )
  };

  for (const arrayKey of uniqueKeys.arrays) {
    const arrayValues = msg[arrayKey];

    if (Array.isArray(arrayValues)) {
      for (const item of arrayValues) {
        const baseMsg = createBaseMessage(msg, arrayKey);
        baseMsg[arrayKey] = item;

        const mappedResult = {};

        for (const key of payloadKeys) {
          const [parentKeyName, subKeyName] = key.keyName.split('.');

          if (key.keyType === 'array_obj') {
            if (parentKeyName === arrayKey) {
              mappedResult[key.column] = item[key.subKeyName] ?? null;
            } else {
              mappedResult[key.column] = null;
            }
          } else if (key.keyType === 'object') {
            const objValue = msg[parentKeyName];
            if (objValue && typeof objValue === 'object') {
              mappedResult[key.column] = objValue[key.subKeyName] ?? null;
            } else {
              mappedResult[key.column] = null;
            }
          } else if (key.keyType === 'array_str' || key.keyType === 'array_num') {
            mappedResult[key.column] = key.keyName === arrayKey ?
              item : null;
          } else {
            mappedResult[key.column] = baseMsg[key.keyName];
          }
        }

        processedResults.push(mappedResult);
      }
    }
  }

  if (processedResults.length === 0) {
    for (const objKey of uniqueKeys.objects) {
      const objValue = msg[objKey];

      if (objValue && typeof objValue === 'object') {
        const mappedResult = {};

        for (const key of payloadKeys) {
          const [parentKeyName, subKeyName] = key.keyName.split('.');

          if (key.keyType === 'object') {
            if (parentKeyName === objKey) {
              mappedResult[key.column] = objValue[key.subKeyName] ?? null;
            } else {
              const otherObjValue = msg[parentKeyName];
              mappedResult[key.column] = otherObjValue ?
                otherObjValue[key.subKeyName] ?? null : null;
            }
          } else if (key.keyType.startsWith('array_')) {
            mappedResult[key.column] = null;
          } else {
            mappedResult[key.column] = msg[key.keyName] ?? null;
          }
        }

        processedResults.push(mappedResult);
        break;
      }
    }

    if (processedResults.length === 0) {
      const mappedResult = {};
      for (const key of payloadKeys) {
        if (key.keyType === 'object') {
          const [parentKeyName] = key.keyName.split('.');
          const objValue = msg[parentKeyName];
          mappedResult[key.column] = objValue ?
            objValue[key.subKeyName] ?? null : null;
        } else if (key.keyType.startsWith('array_')) {
          mappedResult[key.column] = null;
        } else {
          mappedResult[key.column] = msg[key.keyName] ?? null;
        }
      }
      processedResults.push(mappedResult);
    }
  }

  return processedResults;
}



async function processInfluxWrite(influxConfig, msg, measurement, precision, payloadKeys, node, done) {
  try {
    const { influxdbVersion, org, bucket, client } = influxConfig;

    if (influxdbVersion === VERSION_20) {
      let payloads = await processPayload(msg, payloadKeys);
      payloads.forEach(async (payload) => {
        await writePointsToInflux(client, { node: msg.node, ...payload }, measurement, org, bucket, precision, payloadKeys, node, msg);
      })
      done();
    }
  } catch (error) {
    msg.influx_error = { errorMessage: error.message };
    console.error("Error writing to InfluxDB:", error);
    done(error);
  }
}


module.exports = {
  processInfluxWrite,
  initializeInfluxDBClient,
  writePointsToInflux,
};
