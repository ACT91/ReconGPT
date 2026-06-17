"""One-time fix: save existing scan results to database."""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.tasks.scan_tasks import _save_results_to_db

async def main():
    job_id = sys.argv[1] if len(sys.argv) > 1 else "f342f494-37cd-478a-b2f3-a0d4b675067d"
    print(f"Saving results for job {job_id}...")
    await _save_results_to_db(job_id)
    print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
