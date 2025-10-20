#!/bin/bash

# Annotation Color Customizer Plugin Build Script

set -e

PLUGIN_NAME="annotation-color-customizer"
# Read version from manifest.json
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
BUILD_DIR="build"
DIST_DIR="dist"
XPI_NAME="${PLUGIN_NAME}-${VERSION}.xpi"

echo "Building Annotation Color Customizer Plugin..."
echo "Version: ${VERSION}"

# Clean build and dist directories
rm -rf "$BUILD_DIR"
#rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

# Copy files to build directory
echo "Copying files..."
cp -r content "$BUILD_DIR/"
cp -r locale "$BUILD_DIR/"
cp -r skin "$BUILD_DIR/"
cp -r icons "$BUILD_DIR/"
cp manifest.json "$BUILD_DIR/"
cp bootstrap.js "$BUILD_DIR/"

# Create XPI file in dist directory
echo "Creating XPI package..."
cd "$BUILD_DIR"
zip -r "../${DIST_DIR}/${XPI_NAME}" ./*
cd ..

# Clean up build directory
rm -rf "$BUILD_DIR"

echo "Build completed: ${DIST_DIR}/${XPI_NAME}"
echo "Install the plugin by dragging the XPI file to Zotero."