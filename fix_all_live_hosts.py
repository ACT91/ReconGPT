"""Fix: update subdomain live host data for all scans with live_hosts.txt."""
import asyncio, json
from pathlib import Path

async def fix():
    from app.core.database import async_session_factory
    from sqlalchemy import select
    from app.models.subdomain import Subdomain, SubdomainStatus
    from datetime import datetime, timezone

    storage_root = Path('/app/storage/jobs')
    already_done = set()

    async with async_session_factory() as session:
        for job_dir in sorted(storage_root.iterdir()):
            if not job_dir.is_dir():
                continue
            live_hosts_file = job_dir / 'live_hosts.txt'
            if not live_hosts_file.exists():
                continue

            job_id_str = job_dir.name

            if job_id_str in already_done:
                continue
            already_done.add(job_id_str)

            hosts = []
            with open(live_hosts_file) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        hosts.append(json.loads(line))

            print(f'[{job_id_str[:8]}] Loaded {len(hosts)} live host entries')

            updated = 0
            for host in hosts:
                name = host.get('host') or host.get('input')
                if not name:
                    continue
                sub = await session.execute(
                    select(Subdomain).where(
                        Subdomain.scan_job_id == job_id_str,
                        Subdomain.name == name,
                    )
                )
                sd = sub.scalar_one_or_none()
                if sd:
                    sd.is_alive = True
                    sd.status_code = host.get('status_code')
                    sd.title = host.get('title')
                    sd.web_server = host.get('webserver')
                    sd.content_length = host.get('content_length')
                    sd.technologies = host.get('tech', [])
                    sd.ips = host.get('a', [])
                    sd.cname = host.get('cname', [None])[0] if host.get('cname') else None
                    sd.probed_at = datetime.now(timezone.utc)
                    sd.status = SubdomainStatus.ALIVE
                    updated += 1

            print(f'[{job_id_str[:8]}] Updated {updated} subdomains with live host data')

        await session.commit()
        print('All done!')

asyncio.run(fix())
