function checkMainFunctionReturn(code) {
  const mainFunctionMatch = /def main\(\):([\s\S]*?)(^\S|\Z)/m.exec(code);
  if (mainFunctionMatch) {
    const mainBody = mainFunctionMatch[1];
    const lines = mainBody.split("\n");

    for (const line of lines) {
      // if (/^\s{4}return\b/.test(line)) {
      //   return true;
      // }
      if (/^\treturn\b/.test(line)) {
        return true;
      }
    }
  }
  return false;
}

module.exports = { checkMainFunctionReturn };
