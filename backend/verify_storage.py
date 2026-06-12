import asyncio
import os
import time
import requests
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Import settings
from app.config import settings

# Setup database async engine
async_engine = create_async_engine(settings.DATABASE_URL)

async def check_db_stats():
    async with async_engine.connect() as conn:
        # 1. Database size
        res_size = await conn.execute(text("SELECT pg_database_size(current_database());"))
        db_size = res_size.scalar()

        # 2. Check if file_url column exists in purchase_invoices
        res_col = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'purchase_invoices' AND column_name = 'file_url';
        """))
        file_url_exists = res_col.first() is not None

        # 3. Row counts
        counts = {}
        for table in ["purchase_invoices", "purchase_invoice_items", "medicines", "batches", "ai_invoice_processing_logs"]:
            res_cnt = await conn.execute(text(f"SELECT COUNT(*) FROM {table};"))
            counts[table] = res_cnt.scalar()

        return {
            "db_size": db_size,
            "file_url_exists": file_url_exists,
            "counts": counts
        }

def get_temp_upload_files():
    # Temp upload directory path
    app_dir = os.path.dirname(os.path.abspath(__file__))
    temp_dir = os.path.join(app_dir, "app", "temp_uploads")
    if not os.path.exists(temp_dir):
        return []
    return os.listdir(temp_dir)

async def run_verification():
    print("======================================================================")
    print("INVOICE PROCESSING STORAGE USAGE VERIFICATION")
    print("======================================================================")
    
    # 1. Wait for server to start
    print("Waiting for backend server to start on http://127.0.0.1:8000 ...")
    max_retries = 30
    for i in range(max_retries):
        try:
            r = requests.get("http://127.0.0.1:8000/health", timeout=1)
            if r.status_code == 200:
                print("Backend server is UP and healthy!")
                break
        except Exception:
            pass
        await asyncio.sleep(1)
    else:
        print("Backend server failed to start in time. Exiting.")
        return

    # 2. Fetch stats before uploads
    print("\nFetching Database and Storage stats BEFORE uploads...")
    before_stats = await check_db_stats()
    before_temp_files = get_temp_upload_files()

    print(f"Database Size: {before_stats['db_size']} bytes")
    print(f"file_url column exists in purchase_invoices: {before_stats['file_url_exists']}")
    for tbl, cnt in before_stats['counts'].items():
        print(f"  Row count for '{tbl}': {cnt}")
    print(f"Files in temp_uploads directory: {before_temp_files}")

    # 3. Get Auth Token
    print("\nLogging in as Admin...")
    login_url = "http://127.0.0.1:8000/api/v1/auth/login"
    login_payload = {
        "email": "admin@medicalstore.com",
        "password": "admin123"
    }
    r_login = requests.post(login_url, json=login_payload)
    if r_login.status_code != 200:
        print(f"Login failed: {r_login.text}")
        return
    token = r_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Logged in successfully. Token retrieved.")

    # 4. Generate 10 dummy files
    print("\nGenerating 10 dummy invoice files...")
    test_files_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify_temp_files")
    os.makedirs(test_files_dir, exist_ok=True)
    
    dummy_filenames = []
    for i in range(1, 11):
        ext = "pdf" if i % 2 == 0 else "png"
        filename = f"test_invoice_bulk_upload_{i}.{ext}"
        filepath = os.path.join(test_files_dir, filename)
        with open(filepath, "wb") as f:
            f.write(f"Dummy file content for invoice #{i} - {uuid.uuid4()}".encode())
        dummy_filenames.append((filepath, filename))
    print(f"Generated 10 dummy files in {test_files_dir}")

    # 5. Upload files and check temp dir contents during upload
    print("\nUploading 10 invoices one-by-one...")
    upload_url = "http://127.0.0.1:8000/api/v1/purchases/invoices/upload-ai"
    
    upload_results = []
    for i, (filepath, filename) in enumerate(dummy_filenames, 1):
        print(f"\nUploading invoice {i}/10: {filename}")
        with open(filepath, "rb") as f:
            files = {"file": (filename, f, "application/pdf" if filename.endswith("pdf") else "image/png")}
            r_upload = requests.post(upload_url, headers=headers, files=files)
        
        # Immediately check temp folder contents after this request returns
        post_request_temp_files = get_temp_upload_files()
        
        if r_upload.status_code == 200:
            res_data = r_upload.json()
            report = res_data.get("report", {})
            print(f"  Upload {i} Success!")
            print(f"  Extracted Invoice Number: {report.get('invoice_number')}")
            print(f"  Extracted Supplier: {report.get('supplier_name')}")
            print(f"  Items: {len(report.get('extracted_items', []))}")
            upload_results.append(True)
        else:
            print(f"  Upload {i} FAILED: {r_upload.status_code} - {r_upload.text}")
            upload_results.append(False)
            
        print(f"  Temp files on disk immediately after upload {i}: {post_request_temp_files}")

    # Clean up generated dummy files
    for filepath, _ in dummy_filenames:
        if os.path.exists(filepath):
            os.remove(filepath)
    if os.path.exists(test_files_dir):
        os.rmdir(test_files_dir)
    print("\nCleaned up local dummy files folder.")

    # 6. Fetch stats after uploads
    print("\nFetching Database and Storage stats AFTER uploads...")
    after_stats = await check_db_stats()
    after_temp_files = get_temp_upload_files()

    db_diff = after_stats['db_size'] - before_stats['db_size']

    print("======================================================================")
    print("VERIFICATION RESULTS SUMMARY")
    print("======================================================================")
    print(f"1. Database size before: {before_stats['db_size']} bytes")
    print(f"   Database size after:  {after_stats['db_size']} bytes")
    print(f"   Database size growth: {db_diff} bytes")
    print(f"2. file_url column exists in purchase_invoices (Before): {before_stats['file_url_exists']}")
    print(f"   file_url column exists in purchase_invoices (After):  {after_stats['file_url_exists']}")
    
    print("\n3. Row counts change:")
    print(f"   {'Table Name':<25} | {'Before':<10} | {'After':<10} | {'Difference':<10}")
    print("-" * 65)
    for tbl in before_stats['counts']:
        b_cnt = before_stats['counts'][tbl]
        a_cnt = after_stats['counts'][tbl]
        diff = a_cnt - b_cnt
        print(f"   {tbl:<25} | {b_cnt:<10} | {a_cnt:<10} | {diff:<+10}")

    print(f"\n4. Files remaining in temp_uploads folder: {after_temp_files}")
    
    db_grows_only_data = not after_stats['file_url_exists']
    no_files_remain = len(after_temp_files) == 0
    all_uploads_succeeded = all(upload_results) and len(upload_results) == 10

    print("\n======================================================================")
    print("CONFIRMATIONS")
    print("======================================================================")
    print(f"- All 10 uploads succeeded:                  {'PASS' if all_uploads_succeeded else 'FAIL'}")
    print(f"- Database grows only from extracted data:   {'PASS' if db_grows_only_data else 'FAIL'}")
    print(f"- No invoice files remain after processing:  {'PASS' if no_files_remain else 'FAIL'}")
    
    if db_grows_only_data and no_files_remain and all_uploads_succeeded:
        print("\nOVERALL STATUS: PASS")
    else:
        print("\nOVERALL STATUS: FAIL")
        
    await async_engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_verification())
