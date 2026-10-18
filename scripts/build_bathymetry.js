#!/usr/bin/env node
// Fetches a bathymetry subset from GEBCO's global grid via OPeNDAP, converts it to
// depth contour bands, and writes the result as GeoJSON to data/bathymetry.json.
//
// GEBCO is a single global 15-arcsecond elevation grid (one CRS, one vertical
// datum, no stitching needed) -- see README.md's Attribution section for the
// citation. We only fetch the small index range covering BBOX, not the full
// 7+ GB global file.
//
// Usage: node scripts/build_bathymetry.js

import { contours } from "d3-contour";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Matches the bbox used for coastline.json and places.json.
const BBOX = { west: -125.2, south: 46.9, east: -122.0, north: 49.3 };

// Depth bands in meters. Kept intentionally coarse -- this is a background
// polish layer, not a navigational chart.
const DEPTH_THRESHOLDS = [10, 50, 100, 150, 200];

const GEBCO_DATASET_URL =
  "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/sub_ice_topography_bathymetry/netcdf/GEBCO_2026_sub_ice.nc";
const GEBCO_GRID_RESOLUTION_DEG = 1 / 240; // 15 arcseconds
const GEBCO_LON_COUNT = 86400;
const GEBCO_LAT_COUNT = 43200;

const OUTPUT_PATH = path.join(__dirname, "..", "data", "bathymetry.json");

function lonToIndex(lon) {
  return Math.round((lon + 180) / GEBCO_GRID_RESOLUTION_DEG);
}

function latToIndex(lat) {
  return Math.round((lat + 90) / GEBCO_GRID_RESOLUTION_DEG);
}

async function fetchElevationSubset() {
  const lonStart = lonToIndex(BBOX.west);
  const lonEnd = Math.min(lonToIndex(BBOX.east), GEBCO_LON_COUNT - 1);
  const latStart = latToIndex(BBOX.south);
  const latEnd = Math.min(latToIndex(BBOX.north), GEBCO_LAT_COUNT - 1);

  const url = `${GEBCO_DATASET_URL}.ascii?elevation[${latStart}:${latEnd}][${lonStart}:${lonEnd}]`;
  console.log(`Fetching GEBCO subset: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GEBCO fetch failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return parseOpendapAsciiGrid(text);
}

// Parses THREDDS OPeNDAP ASCII grid output of the form:
//
//   elevation.elevation[<rows>][<cols>]
//   [0], v0, v1, v2, ...
//   [1], v0, v1, v2, ...
//
//   elevation.lat[<rows>]
//   lat0, lat1, ...
//
//   elevation.lon[<cols>]
//   lon0, lon1, ...
function parseOpendapAsciiGrid(text) {
  const lines = text.split("\n");

  const dataStart = lines.findIndex((l) => l.startsWith("elevation.elevation["));
  const latStart = lines.findIndex((l) => l.startsWith("elevation.lat["));
  const lonStart = lines.findIndex((l) => l.startsWith("elevation.lon["));
  if (dataStart === -1 || latStart === -1 || lonStart === -1) {
    throw new Error("Unexpected OPeNDAP ASCII response shape");
  }

  const rows = [];
  for (let i = dataStart + 1; i < latStart; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(",").slice(1).map(Number);
    rows.push(values);
  }

  const lat = lines[latStart + 1].split(",").map(Number);
  const lon = lines[lonStart + 1].split(",").map(Number);

  return { rows, lat, lon };
}

// Walks a d3-contour MultiPolygon's coordinates (in grid index space) and maps
// each [col, row] pair to [lon, lat] using the grid's actual coordinate arrays.
function reprojectMultiPolygon(geometry, lon, lat) {
  const project = ([col, row]) => {
    const i = Math.min(lon.length - 1, Math.max(0, Math.round(col)));
    const j = Math.min(lat.length - 1, Math.max(0, Math.round(row)));
    return [lon[i], lat[j]];
  };
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) =>
      polygon.map((ring) => ring.map(project))
    ),
  };
}

async function main() {
  const { rows, lat, lon } = await fetchElevationSubset();
  const width = lon.length;
  const height = lat.length;

  // Depth is positive underwater; d3-contour's threshold semantics ("value >=
  // threshold") then nest naturally -- the >=200m region is a subset of the
  // >=100m region, which is a subset of >=50m, and so on.
  const depth = new Float64Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      depth[row * width + col] = -rows[row][col];
    }
  }

  const generator = contours().size([width, height]).thresholds(DEPTH_THRESHOLDS);
  const bands = generator(depth);

  const features = bands.map((band) => ({
    type: "Feature",
    properties: { depth: band.value },
    geometry: reprojectMultiPolygon(band, lon, lat),
  }));

  const featureCollection = { type: "FeatureCollection", features };
  writeFileSync(OUTPUT_PATH, JSON.stringify(featureCollection));
  console.log(`Wrote ${features.length} depth bands to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
