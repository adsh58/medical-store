import google.generativeai as genai
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BadRequestException, RateLimitException, AppException
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
    free_quantity: int = Field(default=0, description="The free quantity of medicine items included in the invoice. If not specified, return 0.")
    purchase_rate: float = Field(description="The purchase rate per unit or pack size")
    mrp: float = Field(description="The maximum retail price (MRP) of the medicine per unit or pack size")
    gst: float = Field(default=0.0, description="The GST rate percentage applied to this medicine, e.g. 12.0 or 18.0. If not specified, return 0.0.")
    company: str = Field(description="The manufacturer/company name of the medicine if available or known. If not present, return empty string.")
    pack_size: str = Field(description="The pack configuration or packaging unit, e.g. 10s, 16x500ml, 15g, if available or known. If not present, return empty string.")
    generic_name: str = Field(description="The generic active ingredient/chemical name of the medicine if available or known. If not present, return empty string.")
    confidence: float = Field(default=1.0, description="The confidence level of this row's extraction from 0.0 to 1.0. Lower confidence indicates ambiguous data alignment.")

class ExtractedInvoice(BaseModel):
    invoice_number: str = Field(description="The invoice number or billing number found on the invoice")
    supplier_name: str = Field(description="The name of the supplying agency, company, or distributor")
    invoice_date: str = Field(description="The invoice issue date in YYYY-MM-DD format")
    supplier_address: Optional[str] = Field(None, description="The physical address of the supplying agency/supplier. Extract full address block if available.")
    supplier_city: Optional[str] = Field(None, description="The city name of the supplying agency/supplier.")
    supplier_state: Optional[str] = Field(None, description="The state name of the supplying agency/supplier.")
    supplier_gst: Optional[str] = Field(None, description="The GST/tax registration number of the supplying agency/supplier.")
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
    free_quantity: int = 0
    new_rate: float
    old_rate: float
    mrp: float
    old_mrp: float
    gst: float = 0.0
    price_changed: bool = False
    difference_percentage: float
    trend: str  # INCREASED, DECREASED, UNCHANGED, NEW_MEDICINE
    alert_triggered: bool
    alert_message: Optional[str] = None
    recommended_doctor_rate: float
    recommended_customer_rate: float
    company: Optional[str] = None
    pack_size: Optional[str] = None
    generic_name: Optional[str] = None
    confidence: float = 1.0
    needs_review: bool = False
    review_reasons: List[str] = []
    category_id: Optional[uuid.UUID] = None

class InvoiceAnalysisReport(BaseModel):
    file_name: str
    invoice_number: str
    supplier_name: str
    invoice_date: date
    extracted_items: List[RateComparisonItem]
    total_increases: int
    total_decreases: int
    supplier_id: Optional[uuid.UUID] = None
    supplier_address: Optional[str] = None
    supplier_city: Optional[str] = None
    supplier_state: Optional[str] = None
    supplier_gst: Optional[str] = None


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
        self, db: AsyncSession, file_bytes: bytes, file_name: str, mime_type: str, store_id: uuid.UUID
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
                
                prompt = (
                    "Analyze this invoice image/document carefully. "
                    "Extract all medicine line items including medicine name, batch number, "
                    "expiry date, quantity, free quantity (or free quantity received, default to 0 if not present), "
                    "MRP (maximum retail price, default to purchase rate * 1.5 if not present), "
                    "purchase rate, and GST rate percentage (e.g. 12.0 or 18.0, default to 0.0 if not present). "
                    "Additionally, try to extract the manufacturer/company name, the packaging pack size (e.g. 10s, 16x500ml, 15g), "
                    "and the generic name / active ingredient for each medicine if they are specified or can be inferred. "
                    "Ensure dates are strictly in YYYY-MM-DD format.\n"
                    "Extract supplier details: physical address, city, state, and GST/tax registration number of the supplier.\n"
                    "CRITICAL: Be extremely careful with row alignment. Ensure that the medicine name, batch number, quantity, purchase rate, and MRP are from the exact same horizontal line in the table. Do not mix values from adjacent rows (which causes row-shift rate mismatches)."
                )

                response_text = None
                errors = []
                
                # Define a clean, manual schema dictionary to prevent Pydantic default-injection issues
                extracted_invoice_schema = {
                    "type": "OBJECT",
                    "properties": {
                        "invoice_number": {
                            "type": "STRING",
                            "description": "The invoice number or billing number found on the invoice"
                        },
                        "supplier_name": {
                            "type": "STRING",
                            "description": "The name of the supplying agency, company, or distributor"
                        },
                        "invoice_date": {
                            "type": "STRING",
                            "description": "The invoice issue date in YYYY-MM-DD format"
                        },
                        "supplier_address": {
                            "type": "STRING",
                            "description": "The physical address of the supplying agency/supplier. Extract full address block if available."
                        },
                        "supplier_city": {
                            "type": "STRING",
                            "description": "The city name of the supplying agency/supplier."
                        },
                        "supplier_state": {
                            "type": "STRING",
                            "description": "The state name of the supplying agency/supplier."
                        },
                        "supplier_gst": {
                            "type": "STRING",
                            "description": "The GST/tax registration number of the supplying agency/supplier."
                        },
                        "items": {
                            "type": "ARRAY",
                            "description": "List of medicine line items",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "medicine_name": {
                                        "type": "STRING",
                                        "description": "The name of the medicine"
                                    },
                                    "batch_no": {
                                        "type": "STRING",
                                        "description": "The batch number of the medicine"
                                    },
                                    "expiry_date": {
                                        "type": "STRING",
                                        "description": "The expiry date of the medicine in YYYY-MM-DD format. If only MM/YY is given, assume last day of that month"
                                    },
                                    "quantity": {
                                        "type": "INTEGER",
                                        "description": "The quantity of the medicine purchased"
                                    },
                                    "free_quantity": {
                                        "type": "INTEGER",
                                        "description": "The free quantity of medicine items included in the invoice. If not specified, return 0."
                                    },
                                    "purchase_rate": {
                                        "type": "NUMBER",
                                        "description": "The purchase rate per unit or pack size"
                                    },
                                    "mrp": {
                                        "type": "NUMBER",
                                        "description": "The maximum retail price (MRP) of the medicine per unit or pack size"
                                    },
                                    "gst": {
                                        "type": "NUMBER",
                                        "description": "The GST rate percentage applied to this medicine, e.g. 12.0 or 18.0. If not specified, return 0.0."
                                    },
                                    "company": {
                                        "type": "STRING",
                                        "description": "The manufacturer/company name of the medicine if available or known. If not present, return empty string."
                                    },
                                    "pack_size": {
                                        "type": "STRING",
                                        "description": "The pack configuration or packaging unit, e.g. 10s, 16x500ml, 15g, if available or known. If not present, return empty string."
                                    },
                                    "generic_name": {
                                        "type": "STRING",
                                        "description": "The generic active ingredient/chemical name of the medicine if available or known. If not present, return empty string."
                                    },
                                    "confidence": {
                                        "type": "NUMBER",
                                        "description": "The confidence level of this row's extraction from 0.0 to 1.0. Lower confidence indicates ambiguous data alignment."
                                    }
                                },
                                "required": [
                                    "medicine_name",
                                    "batch_no",
                                    "expiry_date",
                                    "quantity",
                                    "free_quantity",
                                    "purchase_rate",
                                    "mrp",
                                    "gst",
                                    "company",
                                    "pack_size",
                                    "generic_name",
                                    "confidence"
                                ]
                            }
                        }
                    },
                    "required": ["invoice_number", "supplier_name", "invoice_date", "items"]
                }

                import time
                import asyncio

                models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash"]
                request_count = 0
                rate_limit_occurrences = 0
                response_text = None
                
                for model_name in models_to_try:
                    logger.info(f"Attempting content extraction using model: {model_name}")
                    model = genai.GenerativeModel(model_name)
                    
                    backoff_delays = [10, 20, 40]
                    attempt = 0
                    
                    while attempt <= len(backoff_delays):
                        request_count += 1
                        start_time = time.time()
                        try:
                            logger.info(f"Sending API request {request_count} (attempt {attempt + 1}) to {model_name}")
                            response = model.generate_content(
                                [prompt, media_part],
                                generation_config=genai.GenerationConfig(
                                    response_mime_type="application/json",
                                    response_schema=extracted_invoice_schema,
                                    temperature=0.0
                                )
                            )
                            response_text = response.text
                            duration = time.time() - start_time
                            
                            # Log request details
                            logger.info(
                                f"API request {request_count} succeeded on model {model_name} in {duration:.2f}s. "
                                f"Response length: {len(response_text) if response_text else 0}"
                            )
                            
                            try:
                                token_count = model.count_tokens([prompt, media_part]).total_tokens
                                logger.info(f"Token count for request: {token_count}")
                            except Exception as token_err:
                                logger.warning(f"Could not count tokens: {str(token_err)}")
                                
                            break  # Success, exit retry loop
                        except Exception as e:
                            duration = time.time() - start_time
                            err_msg = str(e)
                            is_429 = "429" in err_msg or "quota" in err_msg.lower() or "exhausted" in err_msg.lower() or "rate limit" in err_msg.lower()
                            
                            if is_429:
                                logger.error(f"Gemini API rate limited (429) on model {model_name}: {err_msg}")
                                raise RateLimitException("AI service is temporarily rate limited. Please try again in a few minutes.")
                            else:
                                logger.error(
                                    f"API request {request_count} to {model_name} failed with non-429 error in {duration:.2f}s: {err_msg}"
                                )
                                errors.append(f"{model_name}: {err_msg}")
                                break
                    
                    if response_text is not None:
                        break
                        
                if response_text is None:
                    raise BadRequestException(f"AI Extraction failed on all fallback models: {'; '.join(errors)}")

                # Parsed schema validation
                extracted_invoice = ExtractedInvoice.model_validate_json(response_text)
                logger.info(f"Gemini API extracted {len(extracted_invoice.items)} items successfully.")

            except Exception as e:
                logger.exception(f"Gemini API call failed: {str(e)}")
                if isinstance(e, AppException):
                    raise e
                if "429" in str(e) or "quota" in str(e).lower() or "exhausted" in str(e).lower() or "rate limit" in str(e).lower():
                    raise RateLimitException("AI service is temporarily rate limited. Please try again in a few minutes.")
                raise BadRequestException(f"AI Extraction failed: {str(e)}")
        else:
            # Fallback mock parsing mode for testing / clean local execution
            logger.info("Generating mock Gemini extraction data...")
            extracted_invoice = self._get_mock_extraction(file_name)

        # Run price trend analysis & comparison
        report = await self._generate_comparison_report(db, extracted_invoice, file_name, store_id)
        return report

    async def _generate_comparison_report(
        self, db: AsyncSession, extracted: ExtractedInvoice, file_name: str, store_id: uuid.UUID
    ) -> InvoiceAnalysisReport:
        analysis_items = []
        total_increases = 0
        total_decreases = 0

        # Resolve or auto-create supplier agency
        supplier_id = None
        if extracted.supplier_name:
            from app.repositories.all_repos import agency_repo
            matched_supplier = await agency_repo.get_by_name_and_address(
                db, name=extracted.supplier_name, address=extracted.supplier_address, store_id=store_id
            )
            if matched_supplier:
                supplier_id = matched_supplier.id
                # Update missing details if present in extraction
                updated_data = {}
                if not matched_supplier.address and extracted.supplier_address:
                    updated_data["address"] = extracted.supplier_address
                if not matched_supplier.city and extracted.supplier_city:
                    updated_data["city"] = extracted.supplier_city
                if not matched_supplier.state and extracted.supplier_state:
                    updated_data["state"] = extracted.supplier_state
                if not matched_supplier.gst_number and extracted.supplier_gst:
                    updated_data["gst_number"] = extracted.supplier_gst
                if updated_data:
                    await agency_repo.update(db, db_obj=matched_supplier, obj_in=updated_data)
                    await db.flush()
            else:
                # Auto-create the supplier agency
                new_supplier = await agency_repo.create(
                    db,
                    obj_in={
                        "store_id": store_id,
                        "name": extracted.supplier_name,
                        "address": extracted.supplier_address,
                        "city": extracted.supplier_city,
                        "state": extracted.supplier_state,
                        "gst_number": extracted.supplier_gst,
                        "is_active": True
                    }
                )
                await db.flush()
                supplier_id = new_supplier.id

        for item in extracted.items:
            # Try to fetch existing medicine matching by name
            medicine = await medicine_repo.get_by_name(db, item.medicine_name, store_id=store_id)
            
            old_rate = 0.0
            old_mrp = 0.0
            trend = "NEW_MEDICINE"
            diff_pct = 0.0
            alert_triggered = False
            alert_message = None
            price_changed = False
            
            # The MRP from invoice
            mrp = item.mrp

            if medicine:
                old_rate = float(medicine.purchase_rate)
                old_mrp = float(medicine.mrp)
                
                # Detect price changes
                if old_rate != item.purchase_rate or old_mrp != mrp:
                    price_changed = True
                
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

            # Row validation checks (needs_review / review_reasons)
            needs_review = False
            review_reasons = []
            
            confidence = getattr(item, "confidence", 1.0)
            if confidence < 0.9:
                needs_review = True
                review_reasons.append(f"Low OCR confidence ({round(confidence * 100)}%)")
                
            if mrp < item.purchase_rate:
                needs_review = True
                review_reasons.append(f"MRP ({mrp}) is less than Purchase Rate ({item.purchase_rate})")
                
            if medicine and old_rate > 0:
                price_diff_pct = abs(item.purchase_rate - old_rate) / old_rate
                if price_diff_pct > 0.50:
                    needs_review = True
                    review_reasons.append(f"Purchase rate changed drastically by {round(price_diff_pct * 100)}% (from {old_rate} to {item.purchase_rate})")

            analysis_items.append(
                RateComparisonItem(
                    medicine_id=medicine.id if medicine else None,
                    medicine_name=item.medicine_name,
                    batch_no=item.batch_no,
                    expiry_date=exp_date,
                    quantity=item.quantity,
                    free_quantity=item.free_quantity,
                    new_rate=item.purchase_rate,
                    old_rate=old_rate,
                    mrp=mrp,
                    old_mrp=old_mrp,
                    gst=item.gst,
                    price_changed=price_changed,
                    difference_percentage=diff_pct,
                    trend=trend,
                    alert_triggered=alert_triggered,
                    alert_message=alert_message,
                    recommended_doctor_rate=round(rec_doctor, 2),
                    recommended_customer_rate=round(rec_customer, 2),
                    company=getattr(item, "company", None),
                    pack_size=getattr(item, "pack_size", None),
                    generic_name=getattr(item, "generic_name", None),
                    confidence=confidence,
                    needs_review=needs_review,
                    review_reasons=review_reasons
                )
            )

        # Convert string date to date object safely
        try:
            inv_date = date.fromisoformat(extracted.invoice_date)
        except ValueError:
            inv_date = date.today()

        return InvoiceAnalysisReport(
            file_name=file_name,
            invoice_number=extracted.invoice_number,
            supplier_name=extracted.supplier_name,
            invoice_date=inv_date,
            extracted_items=analysis_items,
            total_increases=total_increases,
            total_decreases=total_decreases,
            supplier_id=supplier_id,
            supplier_address=extracted.supplier_address,
            supplier_city=extracted.supplier_city,
            supplier_state=extracted.supplier_state,
            supplier_gst=extracted.supplier_gst
        )

    def _get_mock_extraction(self, file_name: Optional[str] = None) -> ExtractedInvoice:
        """
        Mock invoice payload modeling a standard pharmacy supplier invoice.
        """
        invoice_number = "SA-001176"
        supplier_name = "SHIV MEDICAL AGENCY"
        
        if file_name and "SA-001176" not in file_name and "invoice" not in file_name.lower():
            import time
            name_part = file_name.split(".")[0]
            clean_part = "".join(c for c in name_part if c.isalnum() or c in "-_")
            invoice_number = f"INV-{clean_part}-{int(time.time())}"
            supplier_name = "E2E Mock Supplier Agency"

        return ExtractedInvoice(
            invoice_number=invoice_number,
            supplier_name=supplier_name,
            invoice_date="2026-06-11",
            supplier_address="123 Main St, Sector 5",
            supplier_city="Ahmedabad",
            supplier_state="Gujarat",
            supplier_gst="24AAAAS1234A1Z1",
            items=[
                ExtractedInvoiceItem(
                    medicine_name="CEFTUM-500 MG",  # Matches existing medicine to trigger price change
                    batch_no="GUTC25069",
                    expiry_date="2027-12-31",
                    quantity=5,
                    free_quantity=1,
                    purchase_rate=420.00,  # Changed rate (was 418.60)
                    mrp=500.00,
                    gst=12.00,
                    company="GlaxoSmithKline",
                    pack_size="10's",
                    generic_name="Cefuroxime Axetil",
                    confidence=0.98
                ),
                ExtractedInvoiceItem(
                    medicine_name="DIGENE GEL (MINT)",  # Matches existing medicine to trigger price change
                    batch_no="DEM25061",
                    expiry_date="2028-06-30",
                    quantity=10,
                    free_quantity=2,
                    purchase_rate=140.00,  # Changed rate (was 137.71)
                    mrp=175.00,
                    gst=12.00,
                    company="Abbott India",
                    pack_size="200ml",
                    generic_name="Antacid",
                    confidence=0.95
                ),
                ExtractedInvoiceItem(
                    medicine_name="Mock New Medicine AAA",  # Does not exist, triggers auto-creation
                    batch_no="BATCH-AAA99",
                    expiry_date="2027-09-30",
                    quantity=15,
                    free_quantity=0,
                    purchase_rate=50.00,
                    mrp=80.00,
                    gst=18.00,
                    company="Mock Pharma",
                    pack_size="10s",
                    generic_name="Mock Generic",
                    confidence=0.96
                ),
                ExtractedInvoiceItem(
                    medicine_name="ZERODAL TAB",
                    batch_no="ZD9988",
                    expiry_date="2027-08-31",
                    quantity=10,
                    free_quantity=0,
                    purchase_rate=51.22,
                    mrp=75.00,
                    gst=12.00,
                    company="Ipca Laboratories",
                    pack_size="10s",
                    generic_name="Aceclofenac",
                    confidence=0.97
                ),
                ExtractedInvoiceItem(
                    medicine_name="TIXYLIX SYP",
                    batch_no="TX1122",
                    expiry_date="2027-05-31",
                    quantity=5,
                    free_quantity=0,
                    purchase_rate=97.25,
                    mrp=130.00,
                    gst=12.00,
                    company="Abbott",
                    pack_size="60ml",
                    generic_name="Cough Syrup",
                    confidence=0.96
                ),
                ExtractedInvoiceItem(
                    medicine_name="GLIMESTAR-M2 TAB",
                    batch_no="GM5566",
                    expiry_date="2028-02-29",
                    quantity=20,
                    free_quantity=0,
                    purchase_rate=123.22,
                    mrp=180.00,
                    gst=12.00,
                    company="Mankind",
                    pack_size="15s",
                    generic_name="Glimepiride + Metformin",
                    confidence=0.99
                ),
                ExtractedInvoiceItem(
                    medicine_name="AMBRODIL-S SYP",
                    batch_no="AB4433",
                    expiry_date="2027-10-31",
                    quantity=8,
                    free_quantity=0,
                    purchase_rate=27.86,
                    mrp=45.00,
                    gst=12.00,
                    company="Aristo",
                    pack_size="100ml",
                    generic_name="Ambroxol + Salbutamol",
                    confidence=0.98
                )
            ]
        )

    async def search_assistant(self, db: AsyncSession, query: str, store_id: uuid.UUID) -> List[Dict[str, Any]]:
        """
        AI Medicine search assistant utilizing Gemini model configuration to match brand names by symptoms or generics.
        """
        all_meds = await medicine_repo.get_multi(db, limit=200, store_id=store_id)
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

                # Manual schema definition to prevent Pydantic translation issues
                assistant_schema = {
                    "type": "OBJECT",
                    "properties": {
                        "matches": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "medicine_id": {
                                        "type": "STRING",
                                        "description": "UUID string of matching medicine"
                                    },
                                    "matching_reason": {
                                        "type": "STRING",
                                        "description": "Brief reason explaining why it matches the search query"
                                    },
                                    "confidence": {
                                        "type": "NUMBER",
                                        "description": "Match confidence score between 0.0 and 1.0"
                                    }
                                },
                                "required": ["medicine_id", "matching_reason", "confidence"]
                            }
                        }
                    },
                    "required": ["matches"]
                }

                response_text = None
                try:
                    logger.info("Attempting assistant search content generation using schema mode")
                    response = model.generate_content(
                        prompt,
                        generation_config=genai.GenerationConfig(
                            response_mime_type="application/json",
                            response_schema=assistant_schema,
                            temperature=0.0
                        )
                    )
                    response_text = response.text
                except Exception as e:
                    logger.warning(f"Assistant search schema mode failed, using fallback: {str(e)}")
                    logger.exception("Assistant search schema mode stack trace:")
                    
                    fallback_prompt = (
                        prompt +
                        "\n\nIMPORTANT: Return your response strictly as a JSON object matching this schema. "
                        "Do not include any extra text, markdown formatting (like ```json), or explanations. "
                        f"Schema structure:\n{assistant_schema}"
                    )
                    response = model.generate_content(
                        fallback_prompt,
                        generation_config=genai.GenerationConfig(
                            response_mime_type="application/json",
                            temperature=0.0
                        )
                    )
                    resp_text = response.text.strip()
                    if resp_text.startswith("```json"):
                        resp_text = resp_text[7:]
                    if resp_text.endswith("```"):
                        resp_text = resp_text[:-3]
                    resp_text = resp_text.strip()
                    
                    # Validate JSON
                    import json
                    json.loads(resp_text)
                    response_text = resp_text

                logger.info(f"Assistant search response text: {response_text}")
                gemini_res = GeminiAssistantResponse.model_validate_json(response_text)
                
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

