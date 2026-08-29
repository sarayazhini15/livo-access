import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export async function analyzeBill(base64, mimeType = "image/jpeg") {
  const { data } = await axios.post(`${API}/bill/analyze`, {
    image_base64: base64,
    mime_type: mimeType,
  });
  return data;
}

export async function scanCash(base64, mimeType = "image/jpeg") {
  const { data } = await axios.post(`${API}/cash/scan`, {
    image_base64: base64,
    mime_type: mimeType,
  });
  return data;
}
