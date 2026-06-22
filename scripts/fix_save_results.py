import asyncio
from pathlib import Path
from app.tasks.scan_tasks import _save_results_to_db
from app.core.config import settings

async def fix():
    job_id = "f342f494-37cd-478a-b2f3-a0d4b675067d"
    print(f"Saving results for job {job_id}...")
    await _save_results_to_db(job_id)
    print("Done!")

if __name__ == "__main__":
    asyncio.run(fix())
