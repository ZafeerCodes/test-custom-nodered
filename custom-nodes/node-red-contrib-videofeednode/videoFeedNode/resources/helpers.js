/**
 *
 * Frame Transfer timiming
 *
 */
function calculateFTT(frameRate, timing) {
  let transferTime = ((timing / frameRate) * 1000)?.toFixed();
  if (transferTime <= 400 && transferTime >= 0) {
    transferTime = 300;
  } else if (transferTime < 0) {
    transferTime = 200;
  } else {
    transferTime = 400;
  }
  return 100;
}

module.exports = {
  calculateFTT,
};
