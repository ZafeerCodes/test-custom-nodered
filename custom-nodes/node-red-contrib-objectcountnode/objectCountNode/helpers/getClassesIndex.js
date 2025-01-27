function getClassesIndex(rawClasses, selectedClasses) {
  let res = [];
  rawClasses.map((c, i) => {
    if (selectedClasses.includes(c)) {
      res.push(i);
    }
  });
  return res;
}

module.exports = { getClassesIndex };
