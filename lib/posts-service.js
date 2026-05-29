import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp"

import {
  supabaseBucket,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./config.js";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function listPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, caption, image_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((post) => ({
    id: post.id,
    caption: post.caption,
    imageUrl: post.image_url,
    createdAt: post.created_at,
  }));
}

export async function createPost({ caption, file }) {
  const postCaption = String(caption || "").trim().slice(0, 60) || "untitled shame";
  let uploadBuffer = file.buffer;
  let uploadMime = file.mimetype;
  let uploadExt = getSafeExtension(file.originalname, file.mimetype);
  
  if (file.mimetype !== "image/gif") {
    uploadBuffer = await sharp(file.buffer).webp({ quality: 82 }).toBuffer();
    uploadMime = "image/webp";
    uploadExt = ".webp";
  }
  
  const objectPath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${uploadExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from(supabaseBucket)
    .upload(objectPath, uploadBuffer, {
      contentType: uploadMime,
      upsert: false,
    });
  // const extension = getSafeExtension(file.originalname, file.mimetype);
  // const objectPath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;

  // const { error: uploadError } = await supabase.storage
  //   .from(supabaseBucket)
  //   .upload(objectPath, file.buffer, {
  //     contentType: file.mimetype,
  //     upsert: false,
  //   });
  

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(supabaseBucket).getPublicUrl(objectPath);

  const { data, error } = await supabase
    .from("posts")
    .insert({
      caption: postCaption,
      image_path: objectPath,
      image_url: publicUrl,
    })
    .select("id, caption, image_url, created_at")
    .single();

  if (error) {
    await safeRemoveObject(objectPath);
    throw error;
  }

  return {
    id: data.id,
    caption: data.caption,
    imageUrl: data.image_url,
    createdAt: data.created_at,
  };
}

export async function deletePostById(id) {
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select("image_path")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return false;
    }

    throw error;
  }

  await safeRemoveObject(data.image_path);
  return true;
}

async function safeRemoveObject(objectPath) {
  const { error } = await supabase.storage.from(supabaseBucket).remove([objectPath]);
  if (error) {
    throw error;
  }
}

function getSafeExtension(filename, mimeType) {
  const normalized = filename?.includes(".") ? `.${filename.split(".").pop().toLowerCase()}` : "";
  const allowlist = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  if (allowlist.has(normalized)) {
    return normalized;
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  if (mimeType === "image/gif") {
    return ".gif";
  }

  return ".jpg";
}
