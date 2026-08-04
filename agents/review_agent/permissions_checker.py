"""TARA-0048: Browser permissions monitor (R-21)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def attach_permissions_monitor(session: "ReviewSession") -> None:
    """Instrument permissions API, getUserMedia, geolocation, clipboard."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("permission_requests", [])

    session.page.add_init_script("""
        window.__permission_requests = [];

        // Intercept geolocation
        const origGeo = navigator.geolocation;
        if (origGeo) {
            const origGetCurrentPosition = origGeo.getCurrentPosition.bind(origGeo);
            navigator.geolocation.getCurrentPosition = function(success, error, options) {
                window.__permission_requests.push({ api: 'geolocation.getCurrentPosition' });
                return origGetCurrentPosition(success, error, options);
            };
            const origWatchPosition = origGeo.watchPosition.bind(origGeo);
            navigator.geolocation.watchPosition = function(success, error, options) {
                window.__permission_requests.push({ api: 'geolocation.watchPosition' });
                return origWatchPosition(success, error, options);
            };
        }

        // Intercept permissions.query
        if (navigator.permissions && navigator.permissions.query) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = function(descriptor) {
                window.__permission_requests.push({ api: 'permissions.query', descriptor: JSON.stringify(descriptor) });
                return origQuery(descriptor);
            };
        }

        // Intercept getUserMedia
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = function(constraints) {
                window.__permission_requests.push({ api: 'getUserMedia', constraints: JSON.stringify(constraints) });
                return origGetUserMedia(constraints);
            };
        }

        // Intercept clipboard
        if (navigator.clipboard) {
            ['read', 'readText', 'write', 'writeText'].forEach(method => {
                if (navigator.clipboard[method]) {
                    const orig = navigator.clipboard[method].bind(navigator.clipboard);
                    navigator.clipboard[method] = function(...args) {
                        window.__permission_requests.push({ api: 'clipboard.' + method });
                        return orig(...args);
                    };
                }
            });
        }
    """)


def get_permissions_findings(session: "ReviewSession") -> list:
    """Collect permission request findings."""
    raw = session.report.setdefault("raw", {})
    findings = []

    try:
        requests = session.page.evaluate("() => window.__permission_requests || []")
        raw["permission_requests"] = requests
        for req in requests:
            entry = {
                "type": "permission_request",
                "severity": "Kritisch",
                "api": req.get("api"),
                "detail": req,
            }
            findings.append(entry)
            session.report["findings"].append(entry)
    except Exception:
        pass

    return findings
