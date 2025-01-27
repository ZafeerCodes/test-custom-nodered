/**
 *
 * Frame Transfer timiming
 *
 */
function calculateFTT(frameRate, timing) {
  let transferTime = ((timing / frameRate) * 1000)?.toFixed();
  if (transferTime <= 200 && transferTime >= 0) {
    transferTime = 50;
  } else if (transferTime < 0) {
    transferTime = 10;
  } else {
    transferTime = 100;
  }
  return transferTime;
}

module.exports = {
  calculateFTT,
};
