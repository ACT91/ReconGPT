"""Fix: update subdomain live host data from live_hosts.txt JSONL."""
import asyncio, json, sys
sys.path.insert(0, '/app')

async def fix():
    from app.core.database import async_session_factory
    from sqlalchemy import select
    from app.models.subdomain import Subdomain, SubdomainStatus
    from datetime import datetime, timezone
    from uuid import UUID
    from pathlib import Path

    job_id = UUID(sys.argv[1]) if len(sys.argv) > 1 else UUID('f342f494-37cd-478a-b2f3-a0d4b675067d')
    storage_path = Path('/app/storage/jobs') / str(job_id)
    live_hosts_file = storage_path / 'live_hosts.txt'

    if not live_hosts_file.exists():
        print(f'File not found: {live_hosts_file}')
        return

    hosts = []
    with open(live_hosts_file) as f:
        for line in f:
            line = line.strip()
            if line:
                hosts.append(json.loads(line))

    print(f'Loaded {len(hosts)} live host entries')

    async with async_session_factory() as session:
        updated = 0
        for host in hosts:
            name = host.get('host') or host.get('input')
            if not name:
                continue
            sub = await session.execute(
                select(Subdomain).where(
                    Subdomain.scan_job_id == job_id,
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

        await session.commit()
        print(f'Updated {updated} subdomains with live host data')

asyncio.run(fix())
