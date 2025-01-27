const createClient = require('@azure-rest/ai-vision-image-analysis').default;
const { AzureKeyCredential } = require('@azure/core-auth');
const fs = require('fs');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const ComputerVisionClient = require('@azure/cognitiveservices-computervision').ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;
const path = require("path");
const { json } = require('body-parser');
require("dotenv").config();


module.exports = function (RED) {
    function AzureImageNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        console.log(config, "config")

        const endpoint = process.env.VISION_ENDPOINT || "https://masterworks.cognitiveservices.azure.com/";
        const key = process.env.VISION_KEY || "AXDqC6JlCmJV7zMzf3uI5R2HK7dlcfzCTbdQkBRwSCaWmaGZDbEEJQQJ99BAACYeBjFXJ3w3AAAAACOGCIdw";

        if (!endpoint || !key) {
            node.error('Azure Vision endpoint or key is missing. Please set VISION_ENDPOINT and VISION_KEY in your environment variables.');
            return;
        }

        const credential = new AzureKeyCredential(key);
        const visionClient = new ComputerVisionClient(
            new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }),
            endpoint
        );


        const client = createClient(endpoint, credential);

        function getImgBufferByFilePath(filePath) {
            return fs.readFileSync(filePath);
        }



        this.on('input', async function (msg) {
            if (!Array.isArray(msg.files)) {
                node.error('Input must be an array of file paths');
                return;
            }
            const operation = config.inputOperation;
            const features = config.visualFeatures || ['DenseCaptions', 'Tags'];
            const results = { type: operation ?? "", results: [] };

            if (operation === "generalAnalysis") {
                for (const filePath of msg.files) {
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`File does not exist: ${filePath}`);
                    }
                    const imageBuffer = fs.readFileSync(filePath);
                    const response = await client.path('/imageanalysis:analyze').post({
                        body: imageBuffer,
                        queryParameters: { features: features },
                        contentType: 'application/octet-stream',
                    });

                    const iaResult = response.body;
                    const analysisResult = { filePath: getImgBufferByFilePath(filePath) };

                    if (iaResult.denseCaptionsResult) {
                        analysisResult.denseCaptions = iaResult.denseCaptionsResult.values.map(caption => ({
                            text: caption.text,
                            confidence: caption.confidence,
                        }));
                    }

                    if (iaResult.captionResult) {
                        analysisResult.captionResult = iaResult.captionResult.text
                    }


                    if (iaResult.tagsResult) {
                        analysisResult.tags = iaResult.tagsResult.values.map(tag => ({
                            name: tag.name,
                            confidence: tag.confidence,
                        }));
                    }

                    if (iaResult.objectsResult) {
                        analysisResult.objects = iaResult.objectsResult.values.map(obj => ({
                            boundingBox: {
                                x: obj.boundingBox.x,
                                y: obj.boundingBox.y,
                                width: obj.boundingBox.w,
                                height: obj.boundingBox.h
                            },
                            tags: obj.tags.map(tag => ({
                                name: tag.name,
                                confidence: tag.confidence
                            }))
                        }));
                    }
                    results.results.push(analysisResult);
                }
                node.send({ displayOutputType: "carousel", ...results });
            } else if (operation === "read") {
                for (const filePath of msg.files) {
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`File does not exist: ${filePath}`);
                    }
                    const imageBuffer = fs.readFileSync(filePath);
                    const response = await visionClient.readInStream(imageBuffer);
                    const operationLocation = response.operationLocation.split('/').slice(-1)[0];

                    let readResult;
                    while (!readResult || readResult.status !== "succeeded") {
                        await sleep(1000);
                        readResult = await visionClient.getReadResult(operationLocation);
                    }

                    const textResult = { filePath: getImgBufferByFilePath(filePath), recognizedText: [] };
                    for (const page of readResult.analyzeResult.readResults) {
                        for (const line of page.lines) {
                            textResult.recognizedText.push(line.words.map(w => w.text).join(' '));
                        }
                    }
                    results.results.push(textResult);
                }
                node.send({ displayOutputType: "carousel", ...results });

            }

            if (operation === "imageRetrieval") {


                function readImageAsBuffer(filePath) {
                    return fs.readFileSync(filePath);
                }

                async function vectorizeText(endpoint, key, text) {
                    const url = `${endpoint}/computervision/retrieval:vectorizeText?api-version=2024-02-01&model-version=2023-04-15`;
                    const response = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Ocp-Apim-Subscription-Key": key,
                        },
                        body: JSON.stringify({ text }),
                    });

                    if (!response.ok) {
                        throw new Error(`Error vectorizing text: ${response.statusText}`);
                    }
                    const data = await response.json();
                    return data.vector;
                }

                async function vectorizeImageBuffer(endpoint, key, imageBuffer) {
                    const url = `${endpoint}/computervision/retrieval:vectorizeImage?api-version=2024-02-01&model-version=2023-04-15`;
                    const response = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/octet-stream",
                            "Ocp-Apim-Subscription-Key": key,
                        },
                        body: imageBuffer,
                    });

                    if (!response.ok) {
                        throw new Error(`Error vectorizing image: ${response.statusText}`);
                    }
                    const data = await response.json();
                    return data.vector;
                }

                function cosineSimilarity(vector1, vector2) {
                    const dotProduct = vector1.reduce((sum, value, index) => sum + value * vector2[index], 0);
                    const magnitude1 = Math.sqrt(vector1.reduce((sum, value) => sum + value ** 2, 0));
                    const magnitude2 = Math.sqrt(vector2.reduce((sum, value) => sum + value ** 2, 0));
                    return dotProduct / (magnitude1 * magnitude2);
                }

                async function processTextAndImages(text, filePaths, endpoint, key) {
                    try {
                        const textVector = await vectorizeText(endpoint, key, text);

                        const results = [];
                        for (const filePath of filePaths) {
                            try {
                                const imageBuffer = readImageAsBuffer(filePath);

                                const imageVector = await vectorizeImageBuffer(endpoint, key, imageBuffer);

                                const similarity = cosineSimilarity(textVector, imageVector);

                                const threshold = Number(config.threshold) || 0.3

                                if (similarity > threshold) {
                                    results.push({
                                        filePath: imageBuffer,
                                        similarity,
                                    });
                                }
                            } catch (error) {
                                console.error(`Error processing file ${filePath}:`, error.message);
                            }
                        }
                        return results;
                    } catch (error) {
                        console.error(`Error processing text and images: ${error.message}`);
                        throw error;
                    }
                }

                async function getFinalResult() {
                    const endpoint = process.env.VISION_ENDPOINT || "https://masterworks.cognitiveservices.azure.com/";
                    const key = process.env.VISION_KEY || "AXDqC6JlCmJV7zMzf3uI5R2HK7dlcfzCTbdQkBRwSCaWmaGZDbEEJQQJ99BAACYeBjFXJ3w3AAAAACOGCIdw";
                    const text = config.imageRetrievalText;
                    const filePaths = msg.files

                    try {
                        const result = await processTextAndImages(text, filePaths, endpoint, key);
                        results.results = [...result]
                        node.send({ displayOutputType: "carousel", type: results.type, results: results?.results });
                    } catch (error) {
                        console.error(error.message);
                    }
                };
                getFinalResult();

            }


        });

        this.on("close", function (done) {
            done();
        });
    }

    RED.nodes.registerType("azure image analysis", AzureImageNode);
};

