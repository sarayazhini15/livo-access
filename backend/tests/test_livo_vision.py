"""End-to-end backend tests for LIVO vision endpoints (bill + cash)."""
import os
import pytest
import requests

from image_factory import (
    make_correct_receipt,
    make_wrong_math_receipt,
    make_random_photo,
    make_cash_image,
    make_no_cash_image,
)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # frontend/.env holds the external preview URL
    from dotenv import dotenv_values
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")
BASE_URL = (BASE_URL or "http://localhost:8001").rstrip("/")

BILL_URL = f"{BASE_URL}/api/bill/analyze"
CASH_URL = f"{BASE_URL}/api/cash/scan"

TIMEOUT = 180  # vision calls can be slow


# ---------- health ----------
def test_api_root(api_client):
    r = api_client.get(f"{BASE_URL}/api/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("message") == "LIVO API running"


# ---------- /api/bill/analyze ----------
class TestBillAnalyze:
    def test_bill_correct_math_verified(self, api_client):
        payload = {"image_base64": make_correct_receipt(), "mime_type": "image/jpeg"}
        r = api_client.post(BILL_URL, json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        # structure
        for k in ["merchant", "date", "currency", "items", "subtotal",
                  "tax", "total", "verified", "status", "issues"]:
            assert k in data, f"missing key {k}"
        assert data["currency"] == "INR"
        assert isinstance(data["items"], list)
        assert isinstance(data["issues"], list)
        assert isinstance(data["subtotal"], (int, float))
        assert isinstance(data["tax"], (int, float))
        assert isinstance(data["total"], (int, float))
        # math is correct in the source image, so verifier should agree
        assert data["verified"] is True, f"Expected verified=True, got issues={data['issues']}"
        assert data["status"] == "BILL VERIFIED"
        assert data["issues"] == []
        # values close to what was rendered
        assert abs(float(data["total"]) - 525.00) <= 1.0
        assert abs(float(data["subtotal"]) - 500.00) <= 1.0
        assert len(data["items"]) >= 2

    def test_bill_wrong_math_flagged(self, api_client):
        payload = {"image_base64": make_wrong_math_receipt(), "mime_type": "image/jpeg"}
        r = api_client.post(BILL_URL, json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["verified"] is False, f"Expected mismatch flagged. data={data}"
        assert data["status"] == "CHECK BILL"
        assert isinstance(data["issues"], list) and len(data["issues"]) >= 1
        # at least one issue mentions total/subtotal mismatch
        joined = " ".join(data["issues"]).lower()
        assert ("total" in joined) or ("subtotal" in joined) or ("rupees" in joined)

    def test_bill_non_bill_image_returns_wellformed(self, api_client):
        payload = {"image_base64": make_random_photo(), "mime_type": "image/jpeg"}
        r = api_client.post(BILL_URL, json=payload, timeout=TIMEOUT)
        # Should not crash: either 200 well-formed, or 502 "could not read"
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            data = r.json()
            for k in ["items", "subtotal", "tax", "total", "verified",
                      "status", "issues", "currency"]:
                assert k in data
            assert isinstance(data["items"], list)
            assert isinstance(data["issues"], list)

    def test_bill_empty_image_rejected(self, api_client):
        r = api_client.post(BILL_URL, json={"image_base64": "", "mime_type": "image/jpeg"},
                            timeout=30)
        assert r.status_code in (400, 422), r.text


# ---------- /api/cash/scan ----------
class TestCashScan:
    def test_cash_with_notes(self, api_client):
        # multiple denominations
        payload = {"image_base64": make_cash_image([500, 500, 100, 50, 20]),
                   "mime_type": "image/jpeg"}
        r = api_client.post(CASH_URL, json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["currency", "notes", "total", "detected"]:
            assert k in data
        assert data["currency"] == "INR"
        assert isinstance(data["notes"], list)
        assert isinstance(data["total"], (int, float))
        # If model detected notes, verify structure + sort + math
        if data["detected"]:
            assert len(data["notes"]) > 0
            denoms = [n["denomination"] for n in data["notes"]]
            assert denoms == sorted(denoms, reverse=True), "notes must be sorted desc"
            recomputed = round(sum(n["denomination"] * n["count"]
                                   for n in data["notes"]), 2)
            assert abs(recomputed - float(data["total"])) <= 0.01
            for n in data["notes"]:
                assert n["denomination"] > 0 and n["count"] > 0
                assert abs(n["subtotal"] - n["denomination"] * n["count"]) <= 0.01
        else:
            # graceful empty state
            assert data["notes"] == []
            assert data["total"] == 0

    def test_cash_no_notes_image(self, api_client):
        payload = {"image_base64": make_no_cash_image(), "mime_type": "image/jpeg"}
        r = api_client.post(CASH_URL, json=payload, timeout=TIMEOUT)
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            data = r.json()
            assert data["currency"] == "INR"
            assert isinstance(data["notes"], list)
            # We expect no valid notes here
            if not data["detected"]:
                assert data["notes"] == []
                assert data["total"] == 0

    def test_cash_empty_image_rejected(self, api_client):
        r = api_client.post(CASH_URL, json={"image_base64": "", "mime_type": "image/jpeg"},
                            timeout=30)
        assert r.status_code in (400, 422), r.text


# ---------- serialization ----------
def test_no_objectid_leak_in_bill(api_client):
    payload = {"image_base64": make_correct_receipt(), "mime_type": "image/jpeg"}
    r = api_client.post(BILL_URL, json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    assert "_id" not in r.text
