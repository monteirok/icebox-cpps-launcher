#!/bin/bash

# Script to generate macOS iconset from a source PNG
# Usage: ./generate-icons.sh [source-image.png]

# SOURCE_IMAGE="${1:-icon-source.png}"
SOURCE_IMAGE="../assets/images/icons/icon-source.png"
ICONSET_DIR="icon.iconset"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image not found: $SOURCE_IMAGE"
    echo "Usage: ./generate-icons.sh [source-image.png]"
    exit 1
fi

echo "Generating iconset from $SOURCE_IMAGE..."

# Create iconset directory if it doesn't exist
mkdir -p "$ICONSET_DIR"

# Generate all required icon sizes
sips -z 16 16     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512@2x.png"

echo "Iconset generated successfully!"

# Generate .icns file from iconset
echo "Generating icon.icns..."
iconutil -c icns "$ICONSET_DIR" -o icon.icns

if [ $? -eq 0 ]; then
    echo "✓ icon.icns generated successfully!"
else
    echo "✗ Failed to generate icon.icns"
    exit 1
fi

