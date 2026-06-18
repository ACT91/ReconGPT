import sys
sys.path.insert(0, '/app')
from sqlalchemy import create_engine, text
from app.core.config import settings

e = create_engine(str(settings.DATABASE_URL))
c = e.connect()
c.execute(
    text(
        "UPDATE scan_jobs SET owner_id = '335f2da4-4748-448a-8cda-d43622807238' "
        "WHERE owner_id = '777d0f21-c1c1-4155-8eed-9d34859398d8'"
    )
)
c.commit()
r = c.execute(text('SELECT owner_id, COUNT(*) FROM scan_jobs GROUP BY owner_id'))
for x in r:
    print(f'{x[0]}: {x[1]}')
