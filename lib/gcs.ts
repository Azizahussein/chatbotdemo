import { Storage } from "@google-cloud/storage";
import pdf from "pdf-parse";

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

export async function readFileFromGCS(filename: string): Promise<string> {
  const file = bucket.file(filename);
  const [contents] = await file.download();
  if (filename.endsWith(".pdf")) {
    const data = await pdf(contents);
    return data.text || "[Unable to extract text from PDF]";
  }
  return contents.toString("utf-8");
}