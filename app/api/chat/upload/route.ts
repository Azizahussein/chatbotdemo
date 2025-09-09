// /app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";

// Load your service account
const storage = new Storage({
  keyFilename: path.resolve(process.cwd(), "gcs-service-account.json"),
});

const BUCKET_NAME = "file-storage-dac"

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${uuidv4()}-${file.name}`;
    const bucket = storage.bucket(BUCKET_NAME);
    const blob = bucket.file(fileName);

    await blob.save(buffer, {
      contentType: file.type,
      resumable: false,
      public: true, // Optional: Makes the file publicly accessible
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
