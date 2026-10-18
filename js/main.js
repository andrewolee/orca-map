// The Norway hydrophone is a real but unrelated outlier (see the project notes) --
// excluded here so the projection fits tightly around the Puget Sound cluster.
const EXCLUDED_HYDROPHONE_IDS = new Set(["rpi_lehmkuhl"]);

const svg = d3.select("#map");
const width = svg.node().getBoundingClientRect().width;
const height = svg.node().getBoundingClientRect().height;

Promise.all([
  d3.json("data/hydrophones.json"),
  d3.json("data/coastline.json"),
  d3.json("data/places.json"),
  d3.json("data/bathymetry.json"),
]).then(([hydrophones, coastline, places, bathymetry]) => {
  const visible = hydrophones.filter((h) => !EXCLUDED_HYDROPHONE_IDS.has(h.id));

  // Build a GeoJSON FeatureCollection so the projection can auto-fit to the
  // actual data bounds, rather than hand-picking a center/scale.
  const points = {
    type: "FeatureCollection",
    features: visible.map((h) => ({
      type: "Feature",
      properties: { id: h.id, name: h.name },
      geometry: { type: "Point", coordinates: [h.longitude, h.latitude] },
    })),
  };

  // Fit to the coastline's extent, not the pins' -- the coastline covers a
  // wider area, so this keeps the pins from pinning the zoom level.
  const projection = d3.geoMercator().fitExtent(
    [
      [40, 40],
      [width - 40, height - 40],
    ],
    coastline
  );

  const pathGenerator = d3.geoPath(projection);

  // Same fill color at each depth band, stacked shallow-to-deep so overlapping
  // (nested) regions accumulate opacity -- deeper water reads darker without
  // needing to compute the band differences explicitly.
  const bathymetryBands = [...bathymetry.features].sort(
    (a, b) => a.properties.depth - b.properties.depth
  );

  svg
    .selectAll(".bathymetry-band")
    .data(bathymetryBands)
    .join("path")
    .attr("class", "bathymetry-band")
    .attr("d", pathGenerator);

  svg
    .selectAll(".coastline")
    .data(coastline.features)
    .join("path")
    .attr("class", "coastline")
    .attr("d", pathGenerator);

  svg
    .selectAll(".place-dot")
    .data(places)
    .join("circle")
    .attr("class", "place-dot")
    .attr("r", 2)
    .attr("cx", (d) => projection([d.longitude, d.latitude])[0])
    .attr("cy", (d) => projection([d.longitude, d.latitude])[1]);

  svg
    .selectAll(".place-label")
    .data(places)
    .join("text")
    .attr("class", "place-label")
    .attr("x", (d) => projection([d.longitude, d.latitude])[0] + 6)
    .attr("y", (d) => projection([d.longitude, d.latitude])[1] + 3)
    .text((d) => d.name);

  const pins = svg
    .selectAll(".hydrophone-pin")
    .data(points.features)
    .join("circle")
    .attr("class", "hydrophone-pin")
    .attr("r", 6)
    .attr("cx", (d) => projection(d.geometry.coordinates)[0])
    .attr("cy", (d) => projection(d.geometry.coordinates)[1]);

  svg
    .selectAll(".hydrophone-label")
    .data(points.features)
    .join("text")
    .attr("class", "hydrophone-label")
    .attr("x", (d) => projection(d.geometry.coordinates)[0] + 10)
    .attr("y", (d) => projection(d.geometry.coordinates)[1] + 4)
    .text((d) => d.properties.name);
});
