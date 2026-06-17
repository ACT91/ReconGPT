"""Fix script to update existing scans with live host data"""
import asyncio
import json
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.job import ScanJob
from app.models.subdomain import Subdomain, SubdomainStatus
from app.core.config import settings


async def fix_live_hosts():
    async with async_session_factory() as session:
        result = await session.execute(select(ScanJob))
        jobs = result.scalars().all()
        
        for job in jobs:
            print(f"Processing job: {job.id} - {job.target_domain}")
            storage_path = Path(settings.STORAGE_PATH) / str(job.id)
            live_hosts_file = storage_path / "live_hosts.txt"
            
            if not live_hosts_file.exists():
                print(f"  No live_hosts.txt found")
                continue
            
            updated_count = 0
            with open(live_hosts_file) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        host = json.loads(line)
                        if not isinstance(host, dict):
                            continue
                        
                        name = host.get("host") or host.get("input")
                        if not name:
                            continue
                        
                        subdomain_result = await session.execute(
                            select(Subdomain).where(
                                Subdomain.scan_job_id == job.id,
                                Subdomain.name == name,
                            )
                        )
                        sd = subdomain_result.scalar_one_or_none()
                        if sd:
                            sd.is_alive = True
                            sd.status_code = host.get("status_code")
                            sd.title = host.get("title")
                            sd.web_server = host.get("webserver")
                            sd.content_length = host.get("content_length")
                            sd.technologies = host.get("tech", [])
                            sd.ips = host.get("a", [])
                            cnames = host.get("cname", [])
                            sd.cname = cnames[0] if cnames else None
                            sd.probed_at = datetime.now(timezone.utc)
                            sd.status = SubdomainStatus.ALIVE
                            updated_count += 1
                    except json.JSONDecodeError:
                        continue
            
            await session.commit()
            print(f"  Updated {updated_count} subdomains")
    
    print("Done!")


if __name__ == "__main__":
    asyncio.run(fix_live_hosts())
