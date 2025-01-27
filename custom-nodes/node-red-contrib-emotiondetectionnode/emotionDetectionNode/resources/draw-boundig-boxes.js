const sharp = require("sharp");
const text2png = require("text2png");
const { hexToRgb } = require("./helpers");

// async function draw_bounding_boxes(buffer, boxes) {
//   try {
//     let image = sharp(buffer);
//     let composites = [];

//     if (boxes.length > 0) {
//       for (const [x_min, y_min, x_max, y_max, label, prob] of boxes) {
//         const width = x_max - x_min;
//         const height = y_max - y_min;

//         if (width > 0 && height > 0) {
//           const greenBox = await sharp({
//             create: {
//               width: Math.round(width),
//               height: 5,
//               channels: 4,
//               background: { r: 0, g: 255, b: 0, alpha: 1 },
//             },
//           })
//             .png()
//             .toBuffer();

//           const greenBoxVertical = await sharp({
//             create: {
//               width: 5,
//               height: Math.round(height),
//               channels: 4,
//               background: { r: 0, g: 255, b: 0, alpha: 1 },
//             },
//           })
//             .png()
//             .toBuffer();

//           composites.push(
//             {
//               input: greenBox,
//               top: Math.round(y_min),
//               left: Math.round(x_min),
//             },
//             {
//               input: greenBox,
//               top: Math.round(y_max - 2),
//               left: Math.round(x_min),
//             },
//             {
//               input: greenBoxVertical,
//               top: Math.round(y_min),
//               left: Math.round(x_min),
//             },
//             {
//               input: greenBoxVertical,
//               top: Math.round(y_min),
//               left: Math.round(x_max - 2),
//             }
//           );

//           // Create label text
//           const labelText = text2png(`${label} (${(prob * 100).toFixed(1)}%)`, {
//             color: "#00FF00",
//             backgroundColor: "transparent",
//             font: "25px Arial",
//             fontWeight: "700",
//             // padding: 20,
//           });

//           composites.push({
//             input: labelText,
//             top: Math.round(y_min - 30),
//             left: Math.round(x_min),
//           });
//         }
//       }

//       const compositeBuffer = await image.composite(composites).toBuffer();
//       return compositeBuffer;
//     } else {
//       return buffer;
//     }
//   } catch (error) {
//     console.error("Error in draw_bounding_boxes function:", error);
//     throw error;
//   }
// }

async function draw_bounding_boxes(
  buffer,
  detectedObjects,
  boundingBoxColor,
  labelColor,
  fontSize,
  count = 0
) {
  try {
    let image = sharp(buffer);
    let composites = [];

    // const redFrameText = text2png(`No. of Detected Persons: ${count || 0}`, {
    //   color: labelColor || "#00FF00",
    //   backgroundColor: "transparent",
    //   font: `${fontSize}px Arial`,
    //   fontWeight: "800",
    // });

    const metadata = await image.metadata();
    // const { width, height } = metadata;

    // if (count) {
    //   composites.push({
    //     input: redFrameText,
    //     top: 15,
    //     left: width - 400,
    //   });
    // }

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
      return `
            <rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"
                style="fill:none;stroke:#00FF00;stroke-width:5" />
            <text x="${x1}" y="${
        y1 - 5
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
