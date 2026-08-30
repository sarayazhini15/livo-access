# LIVO — AI-Powered Visual Assistance for Everyday Documents & Cash
## 🚀 Live Demo

👉 **[Try LIVO Live](https://livo-access-1.emergent.host)**

No installation required — open the link to try the application.
> **LIVO (Look • Interpret • Verify • Operate)** is an AI-powered visual assistance application designed to help users understand everyday financial information such as bills, receipts, and Indian currency through a simple camera-based interface.

## 🚀 Problem

Everyday financial information can be difficult to understand when it is presented on small, crowded, or visually complex documents.

Bills may contain:
- Multiple items and quantities
- Discounts and coupons
- GST/taxes
- Delivery and service charges
- A final payable amount

Similarly, identifying Indian currency notes from a photograph can be difficult in real-world situations.

LIVO converts these visual inputs into structured, understandable information.

---

## 💡 Our Solution

LIVO provides two core AI-powered workflows:

### 1. AI Bill & Receipt Analyzer

A user captures or uploads a photograph of a bill.

The system:

1. Accepts the image from the frontend.
2. Sends the image to the backend.
3. Uses a vision-capable Gemini model to understand the bill.
4. Extracts merchant, date, items, quantities, prices and charges.
5. Recalculates the bill totals.
6. Compares the calculated amount with the printed final amount.
7. Reports whether the bill is consistent or requires verification.
8. Stores the scan for future reference.

### 2. Indian Currency Recognition

A user captures an image containing Indian currency notes.

The system:

1. Receives the image.
2. Sends it to the AI vision model.
3. Identifies clearly visible denominations.
4. Groups identical denominations.
5. Calculates the total cash value.
6. Presents the result in a simple structured format.

---

## 🧠 What Makes LIVO Different?

LIVO is not simply an image-to-text OCR wrapper.

The system adds a **verification layer** after AI extraction.

For bills, the extracted values are mathematically reconciled:

`Expected Total = Subtotal - Discounts + Taxes + Charges + Adjustments`

The calculated amount is then compared with the amount printed on the bill.

If there is a mismatch, LIVO does not silently accept the AI result. Instead, it flags the bill for verification.

This creates a pipeline of:

**Vision → Structured Extraction → Validation → User-Friendly Result**

---

## 🏗️ System Architecture

```text
                   ┌──────────────────────┐
                   │       USER           │
                   │ Camera / Image Input │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │   React Frontend     │
                   │   User Interface     │
                   └──────────┬───────────┘
                              │
                         HTTP / REST
                              │
                              ▼
                   ┌──────────────────────┐
                   │   FastAPI Backend    │
                   │   /api endpoints     │
                   └──────────┬───────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
       ┌─────────────────┐        ┌─────────────────┐
       │ Gemini Vision   │        │    MongoDB      │
       │ AI Analysis     │        │ Persistent Data │
       └────────┬────────┘        └─────────────────┘
                │
                ▼
       ┌──────────────────────┐
       │ Structured JSON      │
       │ Extraction           │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │ Validation Engine    │
       │ Bill reconciliation  │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │ Verified Result      │
       │ / Warning / Total    │
       └──────────────────────┘# Here are your Instructions
