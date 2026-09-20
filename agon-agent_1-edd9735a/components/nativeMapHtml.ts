// Self-contained Leaflet map loaded inside a WebView for iOS/Android.
// All map tiles, routing lines and camera markers come from data injected
// by the RN side (real GPS fixes, real OSRM routes, real OSM camera nodes) —
// nothing here is simulated.
export const NATIVE_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #0B1220; }
    .uknp-user-dot { width:22px;height:22px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.35); }
    .uknp-user-arrow { width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:16px solid #3b82f6;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
    .uknp-cam-icon { display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,0.45); }
    .uknp-dest-pin { width:16px;height:16px;border-radius:50% 50% 50% 0;background:#ef4444;border:2px solid #fff;transform:rotate(-45deg); }
    .leaflet-control-attribution { font-size:9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true, minZoom: 3 }).setView([51.5074, -0.1278], 15);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: true, metric: true }).addTo(map);

    var TILE_SETS = {
      night: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', sub: 'abcd', attr: '© OpenStreetMap contributors © CARTO', maxZoom: 20 },
      day: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', sub: 'abcd', attr: '© OpenStreetMap contributors © CARTO', maxZoom: 20 },
      // Esri imagery tops out ~z19 in the UK; maxZoom > maxNativeZoom lets
      // Leaflet upscale rather than ever showing a blank "not available" tile.
      satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: 'abc', attr: 'Tiles © Esri', maxZoom: 20, maxNativeZoom: 19 }
    };
    // Label/place-name overlay stacked on top of the label-free satellite
    // imagery so every town, road and junction stays clearly named at any
    // zoom level, exactly like the day/night styles which bake labels in.
    var LABELS_OVERLAY = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attr: 'Labels © Esri', maxZoom: 20, maxNativeZoom: 19 };
    // If a tile request fails (rate limit / transient network blip) swap it
    // for an OpenStreetMap standard tile instead of leaving a grey hole, so
    // the map never shows a "not available" gap at any zoom level.
    function fallbackTileUrl(z, x, y) {
      var sub = ['a', 'b', 'c'][(x + y) % 3];
      return 'https://' + sub + '.tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
    }
    // Tracks consecutive failures across BOTH the primary source and its OSM
    // fallback. If real live map data genuinely can't be reached (not just a
    // single flaky tile), we tell React Native so it can show a transient
    // "reconnecting" indicator and force a full redraw \u2014 the map is never
    // left silently dead / "not available".
    function attachTileFallback(layer) {
      var consecutiveFailures = 0;
      var retryTimer = null;
      layer.on('tileload', function () {
        consecutiveFailures = 0;
        post({ type: 'health', healthy: true });
      });
      layer.on('tileerror', function (e) {
        if (e && e.coords && e.tile) {
          var fallbackUrl = fallbackTileUrl(e.coords.z, e.coords.x, e.coords.y);
          if (e.tile.src !== fallbackUrl) {
            e.tile.src = fallbackUrl;
            return;
          }
        }
        consecutiveFailures += 1;
        if (consecutiveFailures >= 4) {
          post({ type: 'health', healthy: false });
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(function () { layer.redraw(); }, 1500);
        }
      });
    }

    var tileLayer = null;
    var labelsLayer = null;
    function setTheme(theme) {
      if (tileLayer) map.removeLayer(tileLayer);
      if (labelsLayer) { map.removeLayer(labelsLayer); labelsLayer = null; }
      var t = TILE_SETS[theme] || TILE_SETS.night;
      tileLayer = L.tileLayer(t.url, { subdomains: t.sub, attribution: t.attr, maxZoom: t.maxZoom, maxNativeZoom: t.maxNativeZoom }).addTo(map);
      attachTileFallback(tileLayer);
      if (theme === 'satellite') {
        labelsLayer = L.tileLayer(LABELS_OVERLAY.url, { attribution: LABELS_OVERLAY.attr, maxZoom: LABELS_OVERLAY.maxZoom, maxNativeZoom: LABELS_OVERLAY.maxNativeZoom, pane: 'shadowPane' }).addTo(map);
        attachTileFallback(labelsLayer);
      }
      forceResize();
    }
    setTheme('night');

    // Fix for the map ever appearing as a blank page or a narrow sliver of
    // tiles inside the WebView: the initial layout pass can report a tiny
    // viewport size before the surrounding native layout settles — this is
    // especially common the instant the full-screen Navigation view mounts.
    // Forcing Leaflet to re-measure a few times, plus on every window
    // resize/orientation change, guarantees a full, correctly-sized map.
    function forceResize() {
      try { map.invalidateSize({ animate: false }); } catch (e) {}
    }
    window.addEventListener('resize', forceResize);
    window.addEventListener('orientationchange', function () { setTimeout(forceResize, 200); });
    setTimeout(forceResize, 120);
    setTimeout(forceResize, 400);
    setTimeout(forceResize, 900);

    map.on('click', function (e) {
      post({ type: 'click', lat: e.latlng.lat, lon: e.latlng.lng });
    });
    map.on('dragstart', function () {
      post({ type: 'pan' });
    });

    function post(obj) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }

    var userMarker = null;
    function setUser(lat, lon, heading) {
      var html = '<div style="transform: rotate(' + heading + 'deg); display:flex; flex-direction:column; align-items:center;">' +
        '<div class="uknp-user-arrow"></div><div class="uknp-user-dot" style="margin-top:-6px;"></div></div>';
      var icon = L.divIcon({ html: html, className: '', iconSize: [30, 40], iconAnchor: [15, 24] });
      if (!userMarker) {
        userMarker = L.marker([lat, lon], { icon: icon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarker.setLatLng([lat, lon]);
        userMarker.setIcon(icon);
      }
    }

    var following = true;
    var navigatingMode = false;
    function setFollow(follow, navigating, lat, lon) {
      following = follow;
      navigatingMode = navigating;
      if (follow && lat != null && lon != null) {
        map.setView([lat, lon], navigating ? 17 : map.getZoom(), { animate: true, duration: 0.2 });
      }
    }

    var destMarker = null;
    function setDestination(lat, lon) {
      if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
      if (lat != null && lon != null) {
        var icon = L.divIcon({ html: '<div class="uknp-dest-pin"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 14] });
        destMarker = L.marker([lat, lon], { icon: icon }).addTo(map);
      }
    }

    var routeLine = null;
    var traveledLine = null;
    function setRoute(coords, traveledCount, follow) {
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (traveledLine) { map.removeLayer(traveledLine); traveledLine = null; }
      if (coords && coords.length > 1) {
        routeLine = L.polyline(coords, { color: '#3b82f6', weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(map);
        if (traveledCount > 1) {
          traveledLine = L.polyline(coords.slice(0, traveledCount), { color: '#64748b', weight: 6, opacity: 0.8, lineCap: 'round' }).addTo(map);
        }
        if (!follow) {
          map.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });
        }
      }
    }

    var camMarkers = {};
    function setCameras(cams) {
      var nextIds = {};
      cams.forEach(function (c) { nextIds[c.id] = true; });
      Object.keys(camMarkers).forEach(function (id) {
        if (!nextIds[id]) { map.removeLayer(camMarkers[id]); delete camMarkers[id]; }
      });
      cams.forEach(function (c) {
        if (camMarkers[c.id]) return;
        var color = c.kind === 'average' ? '#f59e0b' : c.kind === 'fixed' ? '#ef4444' : '#a855f7';
        var icon = L.divIcon({ html: '<div class="uknp-cam-icon" style="background:' + color + ';">\u{1F4F7}</div>', className: '', iconSize: [26, 26], iconAnchor: [13, 13] });
        var m = L.marker([c.lat, c.lon], { icon: icon });
        m.bindTooltip(c.maxspeedText ? ('Speed camera \u2022 ' + c.maxspeedText) : 'Speed camera', { direction: 'top' });
        m.addTo(map);
        camMarkers[c.id] = m;
      });
    }

    window.uknp = { setTheme: setTheme, setUser: setUser, setFollow: setFollow, setDestination: setDestination, setRoute: setRoute, setCameras: setCameras, invalidateSize: forceResize };
    post({ type: 'ready' });
  </script>
</body>
</html>`;
