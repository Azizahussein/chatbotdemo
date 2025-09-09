import { Storage } from "@google-cloud/storage";

const storage = new Storage();

const bucketName = process.env.GCLOUD_STORAGE_BUCKET_NAME;
if (!bucketName) {
  throw new Error("GCLOUD_STORAGE_BUCKET_NAME is not defined in environment variables");
}
const bucket = storage.bucket(bucketName);

export async function uploadFileToGCS(buffer: Buffer, destination: string, contentType: string) {
    const file = bucket.file(destination);

    await file.save(buffer, {
        contentType,
        resumable: false,
    });

    await file.makePublic();

    return `https://storage.googleapis.com/${bucketName}/${destination}`;
}

export async function readFileFromGCS(path: string): Promise<string> {
  const file = bucket.file(path);

  // Download file content as buffer
  const [contents] = await file.download();

  // Convert buffer to string (assuming UTF-8 text file)
  return contents.toString("utf-8");
}