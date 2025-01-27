const jsonata = require("jsonata");
const { v4: uuidv4 } = require('uuid');

function isIntegerString(value) {
  return /^-?\d+i$/.test(value);
}

function addFieldToPoint(point, name, value) {
  if (name === "time") {
    point.timestamp(value);
  } else if (typeof value === "number") {
    point.floatField(name, value);
  } else if (typeof value === "string") {
    if (isIntegerString(value)) {
      value = parseInt(value.substring(0, value.length - 1));
      point.intField(name, value);
    } else {
      point.stringField(name, value);
    }
  } else if (typeof value === "boolean") {
    point.booleanField(name, value);
  }
}

function addFieldsToPoint(point, fields) {
  for (const prop in fields) {
    const value = fields[prop];
    addFieldToPoint(point, prop, value);
  }
}

function getField(node, kind, value, mainMsg) {
  try {
    switch (kind) {
      case "msg":
        return mainMsg[value];
      case "flow":
        return node.context().flow.get(value);
      case "global":
        return node.context().global.get(value);
      case "num":
        return parseFloat(value);
      case "bool":
        return handleBoolean(value);
      case "json":
        return JSON.parse(value);
      case "env":
        return process.env[value];
      case "str":
        return value.toString();
      case "uuid":
        return uuidv4();
      case "bin":
        return handleBinary(value, "base64");
      case "jsonata":
        return handleJsonata(value);
      case "date":
        return handleDate(value);
      default:
        return value;
    }
  } catch (error) {
    console.error(`Error processing value: ${error.message}`, {
      kind,
      subKind,
      value,
    });
    return null;
  }
}

function handleBinary(value, subKind) {
  switch (subKind) {
    case "base64":
      return Buffer.from(value, "base64");
    case "hex":
      return Buffer.from(value, "hex");
    case "utf8":
      return Buffer.from(value, "utf8").toString("utf8");
    default:
      throw new Error(`Unsupported binary sub-kind: ${subKind}`);
  }
}

function handleJsonata(value) {
  try {
    const expression = jsonata(value);
    const result = expression.evaluate();
    return result;
  } catch (error) {
    throw new Error(`Error evaluating JSONata: ${error.message}`);
  }
}

function handleDate(subKind) {
  switch (subKind) {
    case "iso":
      return new Date().toISOString();
    case "object":
      return `${new Date()}`;
    case "":
      return `${Date.now()}`;
    case "millis":
      return `${Date.now()}`;
    default:
      return new Date().toString();
  }
}

function handleBoolean(value) {
  switch (value) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      return true;
  }
}

module.exports = { addFieldToPoint, addFieldsToPoint, getField };
