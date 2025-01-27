const sharp = require("sharp");
const text2png = require("text2png");
const { hexToRgb } = require("./helpers");

async function draw_bounding_boxes(
  buffer,
  detectedObjects,
  boundingBoxColor,
  labelColor,
  fontSize,
) {
  try {
    // buffer = Uint8Array.isPrototypeOf(buffer) ? Buffer.from(buffer) : buffer;
    const image = sharp(buffer);
    const composites = [];

    const boxPromises = detectedObjects.map(async (detectedObject) => {
      const id = detectedObject?.id || "";
      const { x1: x_min, y1: y_min, x2: x_max, y2: y_max } = detectedObject.boundingBox;
      const label = detectedObject.label;
      const prob = detectedObject.prob;

      const boxWidth = x_max - x_min;
      const boxHeight = y_max - y_min;

      if (boxWidth > 0 && boxHeight > 0) {
        const greenBox = await sharp({
          create: {
            width: Math.round(boxWidth),
            height: 5,
            channels: 4,
            background: { ...hexToRgb(boundingBoxColor), alpha: 1 },
          },
        }).png().toBuffer();

        const greenBoxVertical = await sharp({
          create: {
            width: 5,
            height: Math.round(boxHeight),
            channels: 4,
            background: { ...hexToRgb(boundingBoxColor), alpha: 1 },
          },
        }).png().toBuffer();

        composites.push(
          {
            input: greenBox,
            top: Math.round(y_min),
            left: Math.round(x_min),
          },
          {
            input: greenBox,
            top: Math.round(y_max - 2),
            left: Math.round(x_min),
          },
          {
            input: greenBoxVertical,
            top: Math.round(y_min),
            left: Math.round(x_min),
          },
          {
            input: greenBoxVertical,
            top: Math.round(y_min),
            left: Math.round(x_max - 2),
          }
        );

        const labelText = text2png(
          `${id ? `#${id}` : ""} ${label} (${(prob * 100).toFixed(1)}%)`,
          {
            color: labelColor || "#00FF00",
            backgroundColor: "transparent",
            font: `${fontSize}px Arial`,
            fontWeight: "700",
          }
        );

        composites.push({
          input: labelText,
          top: Math.round(y_min - 30),
          left: Math.round(x_min),
        });
      }
    });

    await Promise.all(boxPromises);

    if (composites.length > 0) {
      return await image.composite(composites).toBuffer();
    } else {
      return buffer;
    }
  } catch (error) {
    console.error("Error in draw_bounding_boxes function:", error);
    throw error;
  }
}

async function annotate_image(buffer, boxes) {
  const img = sharp(buffer).ensureAlpha();

  const { width, height } = await img.metadata();

  const svgOverlays = boxes
    ?.map((box) => {
      const [x1, y1, x2, y2, label, prob] = box;
      return `
            <rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"
                style="fill:none;stroke:#00FF00;stroke-width:5" />
            <text x="${x1}" y="${y1 - 5
        }" fill="#00FF00" font-size="25px">${label} (${(prob * 100).toFixed(
          1
        )}%)</text>
        `;
    })
    .join("\n");

  const svgImage = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            ${svgOverlays}
        </svg>
    `;

  const annotatedImage = await img
    .composite([{ input: Buffer.from(svgImage), blend: "over" }])
    .removeAlpha()
    .png()
    .toBuffer();

  return annotatedImage;
}

module.exports = { draw_bounding_boxes, annotate_image };
