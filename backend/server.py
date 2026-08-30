from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
VISION_MODEL = ("gemini", "gemini-3.1-pro-preview")

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------- Models ----------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class ImagePayload(BaseModel):
    image_base64: str  # pure base64, no data-url prefix
    mime_type: Optional[str] = "image/jpeg"


# ---------------- Helpers ----------------
def _clean_base64(data: str) -> str:
    if not data:
        raise HTTPException(status_code=400, detail="No image provided")
    # Strip data-url prefix if present
    if "," in data and data.strip().startswith("data:"):
        data = data.split(",", 1)[1]
    return data.strip()


def _parse_json(text: str) -> dict:
    """Extract the first JSON object from the model response."""
    if not text:
        raise ValueError("Empty model response")
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("No JSON found in response")
        candidate = text[start:end + 1]
    return json.loads(candidate)


async def _analyze_image(system_message: str, prompt: str, payload: ImagePayload) -> dict:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    b64 = _clean_base64(payload.image_base64)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system_message,
    ).with_model(*VISION_MODEL)
    message = UserMessage(text=prompt, file_contents=[ImageContent(image_base64=b64)])
    try:
        response = await chat.send_message(message)
    except Exception as e:
        logging.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"Vision analysis failed: {e}")
    try:
        return _parse_json(response)
    except Exception as e:
        logging.error("JSON parse failed. Raw: %s", response)
        raise HTTPException(status_code=502, detail=f"Could not read the image clearly. {e}")


def _num(v) -> float:
    try:
        if v is None:
            return 0.0
        if isinstance(v, str):
            v = re.sub(r"[^0-9.\-]", "", v)
            if v in ("", "-", "."):
                return 0.0
        return round(float(v), 2)
    except Exception:
        return 0.0


def _verify_bill(data: dict) -> dict:
    items = []
    for it in data.get("items", []) or []:
        qty = _num(it.get("quantity", 1)) or 1
        unit = _num(it.get("unit_price"))
        line = _num(it.get("line_total"))
        if line == 0 and unit != 0:
            line = round(qty * unit, 2)
        items.append({
            "name": str(it.get("name", "Item")).strip() or "Item",
            "quantity": qty,
            "unit_price": unit,
            "line_total": line,
        })

    subtotal = _num(data.get("subtotal"))
    discount = _num(data.get("discount")) + _num(data.get("coupon"))
    tax = _num(data.get("tax"))
    delivery = _num(data.get("delivery_charge"))
    service = _num(data.get("service_charge")) + _num(data.get("handling_charge")) + _num(data.get("platform_charge"))
    other = _num(data.get("other_adjustments"))  # signed: + adds, - subtracts
    total = _num(data.get("total"))

    issues = []
    tol = 1.0  # rupee tolerance for rounding/percentage taxes

    # Subtotal falls back to the sum of the line items when not printed.
    sum_lines = round(sum(it["line_total"] for it in items), 2)
    computed_subtotal = subtotal if subtotal else sum_lines

    # Reconcile using ONLY the components actually found on the bill.
    expected_total = round(computed_subtotal - discount + tax + delivery + service + other, 2)

    if not total:
        if not items and computed_subtotal == 0:
            issues.append("The bill could not be read clearly. Please try again with a sharper, well-lit photo.")
        else:
            issues.append("The final amount could not be read from the bill. Please try again with a clearer photo.")
    elif abs(expected_total - total) > tol:
        diff = round(abs(total - expected_total), 2)
        issues.append(
            f"I found a difference of rupees {diff:.2f} between the items and the final amount that I could not fully explain. Please verify the bill."
        )

    verified = len(issues) == 0

    return {
        "merchant": str(data.get("merchant") or data.get("merchant_name") or "Unknown merchant").strip(),
        "date": str(data.get("date") or data.get("purchase_date") or "Not found").strip(),
        "currency": "INR",
        "items": items,
        "subtotal": computed_subtotal,
        "discount": round(discount, 2),
        "tax": tax,
        "delivery_charge": delivery,
        "service_charge": service,
        "other_adjustments": other,
        "total": total if total else expected_total,
        "verified": verified,
        "status": "BILL VERIFIED" if verified else "CHECK BILL",
        "issues": issues,
    }


def _summarize_cash(data: dict) -> dict:
    notes = []
    for n in data.get("notes", []) or []:
        denom = _num(n.get("denomination") or n.get("value"))
        count = int(_num(n.get("count") or n.get("quantity") or 1))
        if denom <= 0 or count <= 0:
            continue
        notes.append({
            "denomination": denom,
            "count": count,
            "subtotal": round(denom * count, 2),
        })
    notes.sort(key=lambda x: x["denomination"], reverse=True)
    total = round(sum(n["subtotal"] for n in notes), 2)
    return {
        "currency": "INR",
        "notes": notes,
        "total": total,
        "detected": len(notes) > 0,
    }


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "LIVO API running"}


BILL_SYSTEM = (
    "You are an expert OCR and data extraction engine for Indian shop bills and restaurant receipts. "
    "You read the image carefully and return only strict JSON. Amounts are in Indian Rupees. "
    "Never invent data that is not visible."
)

BILL_PROMPT = (
    "Extract the bill details from this image and return ONLY a JSON object with this exact shape:\n"
    "{\n"
    '  "merchant": "store or restaurant name",\n'
    '  "date": "purchase date as printed",\n'
    '  "items": [{"name": "product name", "quantity": number, "unit_price": number, "line_total": number}],\n'
    '  "subtotal": number,\n'
    '  "discount": number,\n'
    '  "coupon": number,\n'
    '  "tax": number,\n'
    '  "delivery_charge": number,\n'
    '  "service_charge": number,\n'
    '  "other_adjustments": number,\n'
    '  "total": number\n'
    "}\n"
    "Field meanings: subtotal = items total before adjustments; discount = any discount amount reduced (as a POSITIVE number); "
    "coupon = any coupon/promotional reduction (POSITIVE number); tax = GST or other taxes added; "
    "delivery_charge = delivery/shipping fee; service_charge = service, handling or platform fee; "
    "other_adjustments = any other clearly stated adjustment, SIGNED (positive if it adds to the amount, negative if it reduces it); "
    "total = the final payable amount / amount paid.\n"
    "CRITICAL RULES: numbers must be plain numbers without currency symbols or commas. "
    "If quantity is not printed assume 1. If a field is NOT printed on the bill, use null — "
    "NEVER invent or assume a discount, coupon, tax, or fee that is not clearly visible. "
    "Only extract values actually shown. line_total is the amount printed for that line. "
    "Return JSON only, no explanation."
)

CASH_SYSTEM = (
    "You are an expert at recognising Indian Rupee (INR) currency notes from photographs. "
    "You identify each visible banknote by its denomination and count how many of each are visible. "
    "You return only strict JSON and never invent notes that are not clearly visible."
)

CASH_PROMPT = (
    "Look at this image of cash. Identify every clearly visible Indian Rupee banknote. "
    "Valid denominations are 1, 2, 5, 10, 20, 50, 100, 200, 500, 2000. "
    "Return ONLY a JSON object with this exact shape:\n"
    "{\n"
    '  "notes": [{"denomination": number, "count": number}]\n'
    "}\n"
    "Group identical denominations together with a count. "
    "NEVER guess. Only include a note when you are confident of its denomination. "
    "If a note is blurry, overlapping, partially hidden, or poorly lit, leave it out. "
    "If you cannot confidently identify any note, return an empty notes array. Return JSON only."
)


@api_router.post("/bill/analyze")
async def analyze_bill(payload: ImagePayload):
    data = await _analyze_image(BILL_SYSTEM, BILL_PROMPT, payload)
    result = _verify_bill(data)
    try:
        doc = {**result, "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
        await db.bill_scans.insert_one(doc)
    except Exception:
        logging.warning("Could not persist bill scan")
    return result


@api_router.post("/cash/scan")
async def scan_cash(payload: ImagePayload):
    data = await _analyze_image(CASH_SYSTEM, CASH_PROMPT, payload)
    result = _summarize_cash(data)
    try:
        doc = {**result, "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
        await db.cash_scans.insert_one(doc)
    except Exception:
        logging.warning("Could not persist cash scan")
    return result


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
