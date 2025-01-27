function get_count(detectedObjects) {
  let trackingIds = [];

  detectedObjects.map((detectedObject) => {
    if (!trackingIds.includes(detectedObject?.id)) {
      trackingIds.push(detectedObject?.id);
    }
  });

  return trackingIds.length;
}

module.exports = { get_count };
