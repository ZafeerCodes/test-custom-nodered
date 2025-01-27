const sharp = require("sharp");
const text2png = require("text2png");
const { hexToRgb } = require("./helpers");
const path = require("path");

async function draw_bounding_boxes(
  buffer,
  detectedObjects,
  boundingBoxColor,
  labelColor,
  fontSize
) {
  try {
    let image = sharp(buffer);
    let composites = [];
    if (detectedObjects.length > 0) {
      for (const detectedObject of detectedObjects) {
        let id = "";
        if (detectedObject?.id) {
          id = detectedObject.id;
        }
        let x_min = detectedObject.boundingBox.x1;
        let y_min = detectedObject.boundingBox.y1;
        let x_max = detectedObject.boundingBox.x2;
        let y_max = detectedObject.boundingBox.y2;
        let label = detectedObject.label;
        let prob = detectedObject.prob;

      

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
          })
            .png()
            .toBuffer();

          const greenBoxVertical = await sharp({
            create: {
              width: 5,
              height: Math.round(boxHeight),
              channels: 4,
              background: { ...hexToRgb(boundingBoxColor), alpha: 1 },
            },
          })
            .png()
            .toBuffer();

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

          const probText = prob !== undefined ? ` (${(prob * 100).toFixed(1)}%)` : "";
          const labelText = text2png(
            `${id ? `#${id}` : ""} ${label == "happiness" ? "happy" : label}${probText}`,
            {
              color: labelColor || "#00FF00",
              backgroundColor: "transparent",
              font: `${fontSize}px "Segoe UI Emoji"`,
              fontWeight: "700",
            }
          );

          composites.push({
            input: labelText,
            top: Math.round(y_max + 7),
            left: Math.round(x_min),
          });

          const emojiFile = path.join(__dirname, `emojis/${label}.png`,);
          const emojiImage = await sharp(emojiFile).resize(30, 30).toBuffer();
          
          composites.push({
            input: emojiImage,
            top: Math.round(y_max + 5),
            left: Math.round(x_min + 100),
          });
        }
      }

      const compositeBuffer = await image.composite(composites).toBuffer();
      return compositeBuffer;
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
      // Conditional probability display
      const probText = prob !== undefined ? ` (${(prob * 100).toFixed(1)}%)` : "";
      return `
            <rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"
                style="fill:none;stroke:#00FF00;stroke-width:5" />
            <text x="${x1}" y="${y1 - 5}" fill="#00FF00" font-size="25px">
              ${label}${probText}
            </text>
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
