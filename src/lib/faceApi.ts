import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let isLoaded = false;

export const loadFaceApiModels = async () => {
  if (isLoaded) return;
  
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    isLoaded = true;
    console.log('Face API models loaded');
  } catch (error) {
    console.error('Error loading Face API models:', error);
    throw error;
  }
};

export const getFaceDescriptor = async (imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
  const detection = await faceapi
    .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ? Array.from(detection.descriptor) : null;
};

export const compareFaces = (descriptor1: number[], descriptor2: number[]) => {
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  // Threshold for face recognition (lower is stricter)
  // 0.6 is a common default for face-api.js
  return distance < 0.6;
};
