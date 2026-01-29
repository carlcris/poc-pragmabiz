import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/items/upload-image - Upload item image to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "edit");
    if (unauthorized) return unauthorized;

    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const itemId = formData.get("itemId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 });
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const filename = itemId
      ? `${itemId}_${timestamp}.${fileExt}`
      : `item_${timestamp}_${randomString}.${fileExt}`;

    const filePath = `${userData.company_id}/${filename}`;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("item-images")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload image", details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from("item-images").getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrlData.publicUrl,
      path: filePath,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/items/upload-image - Delete item image from Supabase Storage
export async function DELETE(request: NextRequest) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "delete");
    if (unauthorized) return unauthorized;

    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get image path from query params
    const searchParams = request.nextUrl.searchParams;
    const imagePath = searchParams.get("path");

    if (!imagePath) {
      return NextResponse.json({ error: "No image path provided" }, { status: 400 });
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage.from("item-images").remove([imagePath]);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete image", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
