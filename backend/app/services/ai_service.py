import google.generativeai as genai
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BadRequestException
from app.repositories.all_repos import medicine_repo

logger = logging.getLogger("app.ai_service")

# ==========================================
# GEMINI STRUCTURED OUTPUT SCHEMAS
# ==========================================
class ExtractedInvoiceItem(BaseModel):
    medicine_name: str = Field(description="The name of the medicine")
    batch_no: str = Field(description="The batch number of the medicine")
    expiry_date: str = Field(description="The expiry date of the medicine in YYYY-MM-DD format. If only MM/YY is given, assume last day of that month")
    quantity: int = Field(description="The quantity of the medicine purchased")
    purchase_rate: float = Field(description="The purchase rate per unit or pack size")

class ExtractedInvoice(BaseModel):
    items: List[ExtractedInvoiceItem]


# ==========================================
# DOMAIN CHANGE REPORT SCHEMAS
# ==========================================
import uuid

class RateComparisonItem(BaseModel):
    medicine_id: Optional[uuid.UUID] = None
    medicine_name: str
    batch_no: str
    expiry_date: date
    quantity: int
    new_rate: float
    old_rate: float
    difference_percentage: float
    trend: str  # INCREASED, DECREASED, UNCHANGED, NEW_MEDICINE
    alert_triggered: bool
    alert_message: Optional[str] = None
    recommended_doctor_rate: float
    recommended_customer_rate: float

class InvoiceAnalysisReport(BaseModel):
    file_name: str
    extracted_items: List[RateComparisonItem]
    total_increases: int
    total_decreases: int


# ==========================================
# AI INVOICE PROCESSING SERVICE
# ==========================================
class AIService:
    def __init__(self):
        # Configure Gemini API client
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "mock_key":
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.api_configured = True
        else:
            self.api_configured = False
            logger.warning("Gemini API Key is not configured. Running in MOCK mode.")

    async def analyze_invoice(
        self, db: AsyncSession, file_bytes: bytes, file_name: str, mime_type: str
    ) -> InvoiceAnalysisReport:
        """
        Process the uploaded invoice document (PDF/JPG/PNG) via Gemini API.
        Extracts structural item attributes and evaluates database price trends.
        """
        extracted_invoice = None

        if self.api_configured:
            try:
                # Prepare media part
                media_part = {
                    "mime_type": mime_type,
                    "data": file_bytes
                }
                
                # Setup structured generation configuration using gemini-1.5-flash
                model = genai.GenerativeModel("gemini-1.5-flash")
                
                prompt = (
                    "Analyze this invoice image/document carefully. "
                    "Extract all medicine line items including medicine name, batch number, "
                    "expiry date, quantity, and purchase rate. "
                    "Ensure dates are strictly in YYYY-MM-DD format."
                )

                response = model.generate_content(
                    [prompt, media_part],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        response_schema=ExtractedInvoice,
                        temperature=0.0
                    )
                )

                # Parsed schema validation
                extracted_invoice = ExtractedInvoice.model_validate_json(response.text)
                logger.info(f"Gemini API extracted {len(extracted_invoice.items)} items successfully.")

            except Exception as e:
                logger.exception(f"Gemini API call failed: {str(e)}")
                raise BadRequestException(f"AI Extraction failed: {str(e)}")
        else:
            # Fallback mock parsing mode for testing / clean local execution
            logger.info("Generating mock Gemini extraction data...")
            extracted_invoice = self._get_mock_extraction()

        # Run price trend analysis & comparison
        report = await self._generate_comparison_report(db, extracted_invoice, file_name)
        return report

    async def _generate_comparison_report(
        self, db: AsyncSession, extracted: ExtractedInvoice, file_name: str
    ) -> InvoiceAnalysisReport:
        analysis_items = []
        total_increases = 0
        total_decreases = 0

        for item in extracted.items:
            # Try to fetch existing medicine matching by name
            medicine = await medicine_repo.get_by_name(db, item.medicine_name)
            
            old_rate = 0.0
            trend = "NEW_MEDICINE"
            diff_pct = 0.0
            alert_triggered = False
            alert_message = None
            mrp = item.purchase_rate * 1.5  # mock default MRP for recommendations

            if medicine:
                old_rate = float(medicine.current_purchase_rate)
                mrp = float(medicine.mrp)
                
                if old_rate > 0:
                    diff_pct = ((item.purchase_rate - old_rate) / old_rate) * 100.0
                    diff_pct = round(diff_pct, 2)
                    
                    if item.purchase_rate > old_rate:
                        trend = "INCREASED"
                        total_increases += 1
                        alert_triggered = True
                        alert_message = f"PRICE INCREASE ALERT: '{item.medicine_name}' purchase rate rose from {old_rate} to {item.purchase_rate} (+{diff_pct}%)"
                    elif item.purchase_rate < old_rate:
                        trend = "DECREASED"
                        total_decreases += 1
                        alert_message = f"PRICE REDUCTION: '{item.medicine_name}' purchase rate fell from {old_rate} to {item.purchase_rate} ({diff_pct}%)"
                    else:
                        trend = "UNCHANGED"
                else:
                    trend = "UNCHANGED"
            
            # Recommendation pricing (margins: doctor 15%, retail customer 30% capped at MRP)
            rec_doctor = min(item.purchase_rate * 1.15, mrp)
            rec_customer = min(item.purchase_rate * 1.30, mrp)

            # Convert string date to date object safely
            try:
                exp_date = date.fromisoformat(item.expiry_date)
            except ValueError:
                exp_date = date.today()  # fallback safety

            analysis_items.append(
                RateComparisonItem(
                    medicine_id=medicine.id if medicine else None,
                    medicine_name=item.medicine_name,
                    batch_no=item.batch_no,
                    expiry_date=exp_date,
                    quantity=item.quantity,
                    new_rate=item.purchase_rate,
                    old_rate=old_rate,
                    difference_percentage=diff_pct,
                    trend=trend,
                    alert_triggered=alert_triggered,
                    alert_message=alert_message,
                    recommended_doctor_rate=round(rec_doctor, 2),
                    recommended_customer_rate=round(rec_customer, 2)
                )
            )

        return InvoiceAnalysisReport(
            file_name=file_name,
            extracted_items=analysis_items,
            total_increases=total_increases,
            total_decreases=total_decreases
        )

    def _get_mock_extraction(self) -> ExtractedInvoice:
        """
        Mock invoice payload modeling a standard pharmacy supplier invoice.
        """
        return ExtractedInvoice(
            items=[
                ExtractedInvoiceItem(
                    medicine_name="Paracetamol 650mg",
                    batch_no="BATCH-PM990",
                    expiry_date="2027-12-31",
                    quantity=150,
                    purchase_rate=12.50
                ),
                ExtractedInvoiceItem(
                    medicine_name="Amoxicillin 500mg",
                    batch_no="BATCH-AMX122",
                    expiry_date="2028-06-30",
                    quantity=80,
                    purchase_rate=45.00
                ),
                ExtractedInvoiceItem(
                    medicine_name="Atorvastatin 10mg",
                    batch_no="BATCH-ATR311",
                    expiry_date="2027-09-30",
                    quantity=200,
                    purchase_rate=78.20
                )
            ]
        )

    async def search_assistant(self, db: AsyncSession, query: str) -> List[Dict[str, Any]]:
        """
        AI Medicine search assistant utilizing Gemini model configuration to match brand names by symptoms or generics.
        """
        all_meds = await medicine_repo.get_multi(db, limit=200)
        if not all_meds:
            return []

        catalog_summary = [
            {
                "id": str(m.id),
                "name": m.name,
                "generic_name": m.generic_name,
                "company": m.company,
                "pack_size": m.pack_size
            }
            for m in all_meds
        ]

        matched_data = []

        if self.api_configured:
            try:
                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt = (
                    f"You are a pharmacy search assistant helping staff find medicines based on user queries.\n"
                    f"User Query: '{query}'\n"
                    f"Store Catalog: {catalog_summary}\n\n"
                    f"Identify matching medicines. A match includes direct brand name match, brand matching a generic substance, or brand indicated for a symptom/condition (e.g. 'fever' -> matches paracetamol/acetaminophen/ibuprofen, 'blood pressure' -> anti-hypertensives).\n"
                    f"Return the medicine ID, a matching reason explaining why it matches, and a confidence score (0.0 to 1.0)."
                )

                response = model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        response_schema=GeminiAssistantResponse,
                        temperature=0.0
                    )
                )

                gemini_res = GeminiAssistantResponse.model_validate_json(response.text)
                
                # Join with full database objects
                for match in gemini_res.matches:
                    import uuid
                    try:
                        match_id = uuid.UUID(match.medicine_id)
                        med_obj = next((m for m in all_meds if m.id == match_id), None)
                        if med_obj:
                            matched_data.append({
                                "medicine": med_obj,
                                "matching_reason": match.matching_reason,
                                "confidence": match.confidence
                            })
                    except ValueError:
                        continue
            except Exception as e:
                logger.error(f"Gemini assistant search failed: {str(e)}")
                matched_data = self._fallback_assistant_search(all_meds, query)
        else:
            matched_data = self._fallback_assistant_search(all_meds, query)

        # Sort matches by confidence descending
        matched_data.sort(key=lambda x: x["confidence"], reverse=True)
        return matched_data

    def _fallback_assistant_search(self, medicines: List[Any], query: str) -> List[Dict[str, Any]]:
        results = []
        q = query.lower().strip()
        
        # Simple keywords symptom mapping
        symptom_generic_map = {
            "fever": ["paracetamol", "acetaminophen", "ibuprofen"],
            "headache": ["paracetamol", "acetaminophen", "ibuprofen", "aspirin"],
            "pain": ["paracetamol", "acetaminophen", "ibuprofen", "aspirin", "diclofenac"],
            "bp": ["atorvastatin", "amlodipine", "losartan"],
            "blood pressure": ["atorvastatin", "amlodipine", "losartan"],
            "infection": ["amoxicillin", "azithromycin", "clavulanate", "ciprofloxacin"]
        }

        # Check if query matches a symptom keyword
        target_generics = []
        for key, generics in symptom_generic_map.items():
            if key in q:
                target_generics.extend(generics)

        for med in medicines:
            m_name = med.name.lower()
            m_generic = med.generic_name.lower()
            
            # 1. Direct name matches
            if q in m_name or q in m_generic:
                results.append({
                    "medicine": med,
                    "matching_reason": f"Matches query '{query}' in brand name or generic composition.",
                    "confidence": 1.0
                })
            # 2. Generic symptom matches
            elif any(g in m_generic for g in target_generics):
                results.append({
                    "medicine": med,
                    "matching_reason": f"Indicated for '{query}' because it contains '{med.generic_name}'.",
                    "confidence": 0.85
                })

        return results


# ==========================================
# EXTRA ASSISTANT RESPONSE SCHEMAS
# ==========================================
class GeminiAssistantMatch(BaseModel):
    medicine_id: str = Field(description="UUID string of matching medicine")
    matching_reason: str = Field(description="Brief reason explaining why it matches the search query")
    confidence: float = Field(description="Match confidence score between 0.0 and 1.0")

class GeminiAssistantResponse(BaseModel):
    matches: List[GeminiAssistantMatch]


ai_service = AIService()

