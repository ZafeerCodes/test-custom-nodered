const { getField } = require("./common");

async function mapPayloads(payload, payloadKeys, nodeId, node, mainMsg) {
  if (!Array.isArray(payloadKeys) || !payloadKeys.length) {
    return payload;
  }
  let payloads = {};

  const constructPayloadEntry = (el) => {
    let keyName = el.subKeyName ? el.column : el?.keyName;
    if (el.column && el.column !== "") {
      return keyName === "custom" && el.staticValue
        ? { [el.column]: getField(node, el.staticValueType, el.staticValue, mainMsg) }
        : { [el.column]: payload[keyName] ?? payload[keyName] };
    }
    return keyName === "custom" && el.staticValue
      ? { [keyName]: getField(node, el.staticValueType, el.staticValue, mainMsg) }
      : { [keyName]: payload[keyName] ?? payload[keyName] };
  };

  payloadKeys.forEach((el) => {
    const entry = constructPayloadEntry(el);
    if (!payloads[el.node]) {
      payloads[el.node] = [];
    }
    payloads[el.node].push(entry);
  });

  let finalPayload = Object.fromEntries(
    Object.entries(payloads).map(([node, entries]) => [
      node,
      entries.reduce((acc, el) => ({ ...acc, ...el }), {}),
    ])
  );
  return filterAndRemoveTags(finalPayload, nodeId, payloadKeys);
}

function filterAndRemoveTags(finalPayload, nodeId, payloadKeys) {
  let finalKeys = Object.keys(finalPayload[nodeId]);

  let tags = Object.fromEntries(
    payloadKeys
      .filter((el) => finalKeys.includes(el.column) && el.isTag === true)
      .map((el) => [el.column, finalPayload[nodeId][el.column]])
  );

  let keys = Object.fromEntries(
    Object.entries(finalPayload[nodeId]).filter(([key]) => !Object.keys(tags).includes(key))
  );

  return { keys, tags };
}


module.exports = { mapPayloads };
