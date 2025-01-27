const { Worker } = require('worker_threads');
const path = require('path');

function runWorker(workerFuncName, args) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, 'worker-handler.js'), {
      workerData: { workerFuncName, args },
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

module.exports = {
    runWorker
}

/***
 * 
 * For Referance of using
 * 
 */


// const annotatedBuffer = await runWorker('drawBoundingBoxes', [
//   buffer,
//   detectedObjects,
//   boundingBoxColor,
//   labelColor,
//   fontSize
// ]);