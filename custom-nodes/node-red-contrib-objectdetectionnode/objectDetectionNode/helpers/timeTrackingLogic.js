let triggered = false;
let resultMsgs = [];

function createResultMessage(flag, roiKey, object, objectId) {
    return {
        flag,
        roiName: roiKey,
        objectId: objectId,
        object: object.obj,
        entryTime: object?.entryTime ?? null,
        exitTime: object?.exitTime ?? null,
        duration: object?.duration ?? null,
        lastSeen: object?.lastSeen ?? null,
        lastSeenDuration: object?.lastSeenDuration ?? null
    };
}

function addResultMessage(message) {
    triggered = true;
    resultMsgs.push(message);
}

function calculateExitTimeAndDuration(data, currentTime) {
    const exitTime = data.lastSeen;
    const duration = (exitTime - data.entryTime) / 1000;
    const lastSeenDuration = (currentTime - data.lastSeen) / 1000;
    return { exitTime, duration, lastSeenDuration };
}

function checkAndProcessExits(timeTrackingObjectCache, currentTime, threshold) {
    const objectsToRemove = [];

    for (const cachedId in timeTrackingObjectCache) {
        const data = timeTrackingObjectCache[cachedId];
        const timeSinceLastSeen = currentTime - data.lastSeen;

        if (timeSinceLastSeen >= threshold) {
            const { exitTime, duration, lastSeenDuration } = calculateExitTimeAndDuration(data, currentTime);
            addResultMessage(createResultMessage('exit', data.roiKey, {
                obj: data.obj,
                entryTime: data.entryTime,
                exitTime,
                duration,
                lastSeen: data.lastSeen,
                lastSeenDuration
            }, cachedId));

            objectsToRemove.push(cachedId);
        }
    }

    objectsToRemove.forEach(id => delete timeTrackingObjectCache[id]);
}

function processTimeTrackingLogics(timeTrackingObjectCache, rois, threshold = 3000, objectId = null) {
    resultMsgs = [];
    triggered = false;
    const currentTime = Date.now();

    checkAndProcessExits(timeTrackingObjectCache, currentTime, threshold);

    for (const roiKey in rois) {
        const objects = rois[roiKey];
        objects.forEach((obj) => {
            const { tracking_id } = obj;
            if (!timeTrackingObjectCache[tracking_id] && (!objectId || tracking_id == objectId)) {
                timeTrackingObjectCache[tracking_id] = {
                    roiKey,
                    entryTime: currentTime,
                    lastSeen: currentTime,
                    tracking_id,
                    obj
                };

                addResultMessage(createResultMessage('enter', roiKey, {
                    obj: obj,
                    entryTime: currentTime,
                    lastSeen: currentTime,
                    lastSeenDuration: 0
                }, tracking_id));
            }
        });
    }

    for (const cachedId in timeTrackingObjectCache) {
        const data = timeTrackingObjectCache[cachedId];
        const objectsInROI = rois[data.roiKey] || [];
        const isObjectStillPresent = objectsInROI.some(obj => obj.tracking_id === parseInt(cachedId));

        if (isObjectStillPresent) {
            const previousLastSeen = data.lastSeen;
            data.lastSeen = currentTime;

            if (!objectId || cachedId == objectId) {
                const lastSeenDuration = (currentTime - previousLastSeen) / 1000;
                addResultMessage(createResultMessage('present', data.roiKey, {
                    ...data,
                    lastSeenDuration
                }, cachedId));
            }
        } else if (currentTime - data.lastSeen >= threshold) {
            const { exitTime, duration, lastSeenDuration } = calculateExitTimeAndDuration(data, currentTime);
            addResultMessage(createResultMessage('exit', data.roiKey, {
                obj: data.obj,
                entryTime: data.entryTime,
                exitTime,
                duration,
                lastSeen: data.lastSeen,
                lastSeenDuration
            }, cachedId));

            delete timeTrackingObjectCache[cachedId];
        }
    }

    return triggered ? resultMsgs : null;
}

module.exports = processTimeTrackingLogics;
