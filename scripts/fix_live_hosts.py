"""Fix: update subdomain live host data from live_hosts JSONL."""
import asyncio, json, sys
sys.path.insert(0, '/app')


def _load_hosts_from_file(path):
    hosts = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    hosts.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return hosts


def _validate_storage_path(storage_path, storage_base):
    storage_path = storage_path.resolve()
    storage_base = storage_base.resolve()
    if not storage_path.is_relative_to(storage_base):
        print(f'Invalid storage path')
        return None
    return storage_path


async def _update_live_hosts(session, job_id, hosts):
    from sqlalchemy import select
    from app.models.subdomain import Subdomain, SubdomainStatus
    from datetime import datetime, timezone

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
    return updated


async def fix():
    from app.core.database import async_session_factory
    from uuid import UUID
    from pathlib import Path

    job_id = UUID(sys.argv[1]) if len(sys.argv) > 1 else UUID('f342f494-37cd-478a-b2f3-a0d4b675067d')
    storage_base = Path('/app/storage/jobs')
    storage_path = _validate_storage_path(storage_base / str(job_id), storage_base)
    if storage_path is None:
        return

    live_hosts_file = storage_path / 'live_hosts.json'
    if not live_hosts_file.exists():
        live_hosts_file = storage_path / 'live_hosts.txt'

    if not live_hosts_file.exists():
        print(f'No live hosts file found for {job_id}')
        return

    hosts = _load_hosts_from_file(live_hosts_file)
    print(f'Loaded {len(hosts)} live host entries')

    async with async_session_factory() as session:
        updated = await _update_live_hosts(session, job_id, hosts)
        await session.commit()
        print(f'Updated {updated} subdomains with httpx data')


asyncio.run(fix())
