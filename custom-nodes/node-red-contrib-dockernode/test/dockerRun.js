const { exec } = require('child_process');

function checkAndRunContainer(imageName, containerName) {
    return new Promise((resolve, reject) => {
        checkDockerImage(imageName)
            .then(() => {
                exec(`docker ps -a --filter "name=${containerName}" -q`, (error, stdout) => {
                    if (error) {
                        reject(error);
                    } else if (stdout.trim() !== '') {
                        resolve('Container is running');
                    } else {
                        // Container is not running, start it
                        exec(`docker run -d --name ${containerName} ${imageName}`, (error, stdout, stderr) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve('Container started');
                            }
                        });
                    }
                });
            })
            .catch(error => {
                if (error === 'Image not found') {
                    pullImage(imageName)
                        .then(() => {
                            // Try to run the container again
                            checkAndRunContainer(imageName, containerName)
                                .then(result => resolve(result))
                                .catch(error => reject(error));
                        })
                        .catch(error => reject(error));
                } else {
                    reject(error);
                }
            });
    });
}

const checkDockerImage = (imageName) => {
    return new Promise((resolve, reject) => {
        exec(`docker images -q ${imageName}`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stdout.trim() !== '') {
                resolve(); // Image exists
            } else {
                reject('Image not found');
            }
        });
    });
};

const pullImage = (imageName) => {
    return new Promise((resolve, reject) => {
        exec(`docker pull ${imageName}`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(); // Image pulled successfully
            }
        });
    });
};

// Example usage
checkAndRunContainer('my-image:latest', 'my-container')
    .then(result => {
        console.log(result);
    })
    .catch(error => {
        console.error('Error:', error);
    });
