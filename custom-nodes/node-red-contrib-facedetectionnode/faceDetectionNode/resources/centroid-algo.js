

let tracks = []; // Array to store current tracks


function centroidAlgo(detections) {
    let newTracks = [];
    let threshold = 30;

    // Extract centroids from detections
    detections.forEach((detection) => {
        // let { x1, y1, x2, y2 } = detection;
        let x1 = detection[0];
        let y1 = detection[1];
        let x2 = detection[2];
        let y2 = detection[3];
        let label = detection[4];
        let prob = detection[5];


        let centroidX = (x1 + x2) / 2; 
        let centroidY = (y1 + y2) / 2;
        newTracks.push({ id: null, centroid: { x: centroidX, y: centroidY }, boundingBox: { x1, y1, x2, y2 }, label, prob });
    });

    // Match new centroids to existing tracks
    tracks.forEach((track) => {
        let closestDetection = null;
        let minDistance = Infinity;

        newTracks.forEach((newTrack) => {
            let distance = Math.sqrt(
                Math.pow(track.centroid.x - newTrack.centroid.x, 2) +
                Math.pow(track.centroid.y - newTrack.centroid.y, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestDetection = newTrack;
            }
        });

        if (closestDetection && minDistance < threshold) {
            // Update track with new centroid
            track.centroid = closestDetection.centroid;
            closestDetection.id = track.id;
        }
    });

    let latestIndex =  tracks.length + 1;
    newTracks.forEach((newTrack) => {
        if (newTrack.id === null) {
            newTrack.id = latestIndex;
            latestIndex++;
        }
    });
    tracks = newTracks;
    return tracks;
}



 
module.exports = {
    centroidAlgo
}
