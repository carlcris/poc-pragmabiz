"""Local-only concurrency test. Run with Python 3 and local Supabase Docker running.
Creates disposable committed fixtures (required for separate sessions), verifies them,
and removes them in finally. Never reads app credentials or connects to production.
"""
import concurrent.futures
import json
import subprocess
import threading
import time
import uuid

CONTAINER = 'supabase_db_backend'


def sql(statement):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-qAt',
                             '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
                            input=statement, text=True, capture_output=True, check=True, timeout=30)
    return result.stdout.strip()


def run():
    tag = '__CONC_' + uuid.uuid4().hex[:12]
    source, destination = str(uuid.uuid4()), str(uuid.uuid4())
    context = json.loads(sql("""SELECT jsonb_build_object('company',w.company_id,'warehouse',w.id,
      'bu',w.business_unit_id,'user',u.id) FROM public.warehouses w JOIN public.users u ON u.company_id=w.company_id
      WHERE w.deleted_at IS NULL AND w.is_active AND u.is_active
      AND public.user_has_permission(u.id,'manage_locations','create',w.business_unit_id)
      AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id=u.id AND a.business_unit_id=w.business_unit_id)
      ORDER BY w.id,u.id LIMIT 1;"""))
    c, w, bu, user = (context[key] for key in ('company', 'warehouse', 'bu', 'user'))
    auth = f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{user}';"
    source_code, dest_code = tag + '_SRC', tag + '_DST'
    try:
        sql(f"""INSERT INTO public.warehouse_locations(id,company_id,warehouse_id,code,name,location_type)
          VALUES('{source}','{c}','{w}','{source_code}','{tag} source','rack'),
                ('{destination}','{c}','{w}','{dest_code}','{tag} destination','zone');
          INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,code,location_type)
          VALUES('{c}','{w}','{destination}','{dest_code}-R01','rack');""")
        barrier = threading.Barrier(12)
        def create(worker):
            barrier.wait(timeout=20)
            started = time.monotonic()
            result = sql(f"""BEGIN; {auth}
              INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
              SELECT '{c}','{w}','{source}','bin','Worker {worker} bin '||n FROM generate_series(1,5) n;
              SELECT pg_sleep(0.1);
              SELECT count(*) FROM public.warehouse_locations WHERE parent_id='{source}' AND name LIKE 'Worker {worker} bin %';
              COMMIT;""")
            assert result.splitlines()[-1] == '5', result
            return time.monotonic() - started
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            durations = list(pool.map(create, range(12)))
        # Add three more generations, branching at each level: 60 + 3 + 6 + 12 descendants.
        sql(f"""BEGIN; {auth}
          INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
          SELECT '{c}','{w}',b.id,'shelf','Deep shelf' FROM public.warehouse_locations b
          WHERE b.parent_id='{source}' ORDER BY b.code LIMIT 3;
          INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
          SELECT '{c}','{w}',s.id,'crate','Deep crate '||n FROM public.warehouse_locations s
          CROSS JOIN generate_series(1,2) n WHERE s.path_ids @> ARRAY['{source}'::UUID] AND s.location_type='shelf';
          INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
          SELECT '{c}','{w}',cr.id,'bin','Deep bin '||n FROM public.warehouse_locations cr
          CROSS JOIN generate_series(1,2) n WHERE cr.path_ids @> ARRAY['{source}'::UUID] AND cr.location_type='crate';
          COMMIT;""")
        def snapshot():
            return json.loads(sql(f"""SELECT jsonb_agg(jsonb_build_object('id',id,'parent',parent_id,'code',code,
              'type',location_type,'pathIds',path_ids,'path',location_path) ORDER BY id)
              FROM public.warehouse_locations WHERE path_ids @> ARRAY['{source}'::UUID];"""))
        before = snapshot()
        assert len(before) == 82, len(before)
        assert len({row['code'] for row in before}) == 82
        assert {row['code'] for row in before if row['parent'] == source} == {
            source_code + '-B' + str(n).zfill(2) for n in range(1,61)}
        sql(f"BEGIN; {auth} SELECT count(*) FROM public.update_warehouse_location('{bu}','{source}',jsonb_build_object('parent_id','{destination}')); COMMIT;")
        after = snapshot()
        old = {row['id']: row for row in before}
        new = {row['id']: row for row in after}
        assert old.keys() == new.keys(), 'IDs changed or descendants disappeared'
        assert new[source]['code'] == dest_code + '-R02', 'Destination collision was not skipped'
        prefixes = {'zone':'Z','aisle':'A','rack':'R','shelf':'S','bin':'B','crate':'C'}
        for row in after:
            assert row['code'] != old[row['id']]['code'], ('Old code survived', row)
            assert row['pathIds'][0] == destination
            assert row['pathIds'][-1] == row['id']
            assert row['code'] in row['path']
            if row['id'] != source:
                parent = new[row['parent']]
                prefix = parent['code'] + '-' + prefixes[row['type']]
                assert row['code'].startswith(prefix), ('Wrong parent code', row)
                assert row['code'][len(prefix):].isdigit(), row
                assert row['pathIds'] == parent['pathIds'] + [row['id']], row
                assert row['path'].startswith(parent['path'] + ' / '), row
        duplicates = int(sql(f"SELECT count(*) FROM (SELECT code FROM public.warehouse_locations WHERE company_id='{c}' AND warehouse_id='{w}' GROUP BY code HAVING count(*)>1) duplicate_codes;"))
        assert duplicates == 0
        print(json.dumps({'workers':12,'concurrent_creates':60,'subtree_rows':82,
                          'descendants_regenerated':81,'max_depth':max(len(r['pathIds']) for r in after),
                          'duplicate_codes':duplicates,'ids_preserved':True,
                          'parent_codes_and_paths_verified':True,'collision_skipped':True,
                          'slowest_worker_seconds':round(max(durations),3)}, indent=2))
    finally:
        sql(f"""BEGIN;
          DELETE FROM public.warehouse_locations WHERE company_id='{c}' AND warehouse_id='{w}'
            AND (path_ids @> ARRAY['{source}'::UUID] OR path_ids @> ARRAY['{destination}'::UUID]);
          DELETE FROM public.document_code_sequences WHERE company_id='{c}'
            AND starts_with(code_prefix,'warehouse-location:{w}:{tag}');
          COMMIT;""")
        assert sql(f"SELECT count(*) FROM public.warehouse_locations WHERE id IN ('{source}','{destination}')") == '0'
        print('Disposable fixtures and sequence allocations removed.')


def run_simultaneous_moves(force_failure=False):
    tag = '__MOVE_' + uuid.uuid4().hex[:12]
    roots = [str(uuid.uuid4()), str(uuid.uuid4())]
    dest = str(uuid.uuid4())
    context = json.loads(sql("""SELECT jsonb_build_object('company',w.company_id,'warehouse',w.id,
      'bu',w.business_unit_id,'user',u.id) FROM public.warehouses w
      JOIN public.users u ON u.company_id=w.company_id
      WHERE w.deleted_at IS NULL AND w.is_active AND u.is_active
      AND public.user_has_permission(u.id,'manage_locations','create',w.business_unit_id)
      AND public.user_has_permission(u.id,'manage_locations','edit',w.business_unit_id)
      AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
        WHERE a.user_id=u.id AND a.business_unit_id=w.business_unit_id)
      ORDER BY w.id,u.id LIMIT 1;"""))
    c, w, bu, user = (context[key] for key in ('company', 'warehouse', 'bu', 'user'))
    auth = f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{user}';"
    root_array = ','.join(f"'{root}'::uuid" for root in roots)
    dest_code = tag + '_DST'

    def snapshot():
        rows = json.loads(sql(f"""SELECT jsonb_agg(jsonb_build_object('id',id,'parent',parent_id,
          'code',code,'name',name,'type',location_type,'pathIds',path_ids,'path',location_path) ORDER BY id)
          FROM public.warehouse_locations WHERE path_ids && ARRAY[{root_array}];"""))
        return {row['id']: row for row in rows}

    def check_visible(rows, before):
        assert rows.keys() == before.keys(), 'Missing or unexpected descendants'
        assert len({r['code'] for r in rows.values()}) == len(rows), 'Duplicate code'
        states = []
        for root in roots:
            ids = [id for id, row in before.items() if root in row['pathIds']]
            if rows[root] == before[root]:
                assert all(rows[id] == before[id] for id in ids), 'Partially visible subtree move'
                states.append('old')
                continue
            assert rows[root]['parent'] == dest
            assert rows[root]['code'] in (dest_code + '-R02', dest_code + '-R03')
            for id in ids:
                row = rows[id]
                assert row['code'] != before[id]['code'], 'Old descendant code survived'
                assert row['pathIds'] == [dest] + before[id]['pathIds']
                if id == root:
                    assert row['path'] == dest_code + ' - Destination / ' + row['code'] + ' - ' + row['name']
                else:
                    assert row['parent'] == before[id]['parent'], 'Descendant parent changed'
                    parent = rows[row['parent']]
                    prefix = {'bin':'B', 'shelf':'S', 'crate':'C'}[row['type']]
                    suffix = row['code'].removeprefix(parent['code'] + '-' + prefix)
                    assert suffix.isdigit() and int(suffix) > 0, 'Wrong parent code'
                    assert row['path'] == parent['path'] + ' / ' + row['code'] + ' - ' + row['name']
            states.append('new')
        return states

    try:
        for i, root in enumerate(roots):
            sql(f"""INSERT INTO public.warehouse_locations(id,company_id,warehouse_id,code,name,location_type)
              VALUES('{root}','{c}','{w}','{tag}_SRC{i}','Source {i}','rack');
              BEGIN; {auth}
              INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
              SELECT '{c}','{w}','{root}','bin','Bin '||n FROM generate_series(1,4) n;
              INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
              SELECT '{c}','{w}',l.id,'shelf','Shelf '||n FROM public.warehouse_locations l
              CROSS JOIN generate_series(1,2) n WHERE l.parent_id='{root}';
              INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
              SELECT '{c}','{w}',l.id,'crate','Crate '||n FROM public.warehouse_locations l
              CROSS JOIN generate_series(1,2) n WHERE l.path_ids @> ARRAY['{root}'::uuid] AND l.location_type='shelf';
              COMMIT;""")
        sql(f"""INSERT INTO public.warehouse_locations(id,company_id,warehouse_id,code,name,location_type)
          VALUES('{dest}','{c}','{w}','{dest_code}','Destination','zone');
          INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,code,location_type)
          VALUES('{c}','{w}','{dest}','{dest_code}-R01','rack');""")
        before = snapshot()
        assert len(before) == 58
        barrier = threading.Barrier(2)

        def move(i):
            barrier.wait(timeout=10)
            try:
                sql(f"""SET application_name='{tag}_worker{i}'; BEGIN; {auth}
                  SELECT count(*) FROM public.update_warehouse_location('{bu}','{roots[i]}',
                    jsonb_build_object('parent_id','{dest}'));
                  SELECT pg_sleep(0.7);
                  {'SELECT 1/0;' if force_failure and i == 0 else ''}
                  COMMIT;""")
            except subprocess.CalledProcessError as error:
                assert force_failure and i == 0 and 'division by zero' in error.stderr, error.stderr
                return 'rolled_back'
            assert not (force_failure and i == 0), 'Forced failure did not occur'
            return 'committed'

        observations = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            # Hold the warehouse lock so both real RPC requests must overlap and wait.
            blocker = pool.submit(sql, f"""SET application_name='{tag}_blocker'; BEGIN;
              SELECT id FROM public.warehouses WHERE id='{w}' FOR UPDATE;
              SELECT pg_sleep(4); COMMIT;""")
            deadline = time.monotonic() + 10
            while sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{tag}_blocker' AND wait_event='PgSleep'") != '1':
                assert time.monotonic() < deadline, 'Lock holder did not start'
                time.sleep(0.05)
            futures = [pool.submit(move, i) for i in range(2)]
            deadline = time.monotonic() + 3
            while sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name IN ('{tag}_worker0','{tag}_worker1') AND wait_event_type='Lock'") != '2':
                assert time.monotonic() < deadline, 'Two overlapping move requests not observed'
                time.sleep(0.05)
            while not all(f.done() for f in futures):
                check_visible(snapshot(), before)
                observations += 1
                time.sleep(0.05)
            results = [f.result() for f in futures]
            blocker.result()
        after = snapshot()
        states = check_visible(after, before)
        assert states == (['old','new'] if force_failure else ['new','new']), states
        assert results == (['rolled_back','committed'] if force_failure else ['committed','committed'])
        if force_failure:
            assert after[roots[1]]['code'] == dest_code + '-R02', 'Failed transaction consumed a code'
        else:
            assert {after[root]['code'] for root in roots} == {dest_code + '-R02', dest_code + '-R03'}
        assert sql(f"SELECT count(*) FROM (SELECT code FROM public.warehouse_locations WHERE warehouse_id='{w}' GROUP BY code HAVING count(*)>1) duplicates") == '0'
        print(json.dumps({'scenario':'simultaneous_moves_with_failure' if force_failure else 'simultaneous_moves',
          'overlapping_authenticated_requests':2,'rows_per_subtree':29,'descendants_per_subtree':28,
          'outcomes':results,'observer_snapshots':observations,'partial_updates':0,'duplicate_codes':0,
          'ids_and_full_paths_verified':True,'rollback_verified':force_failure}, indent=2))
    finally:
        sql(f"""BEGIN; DELETE FROM public.warehouse_locations WHERE warehouse_id='{w}'
          AND path_ids && ARRAY[{root_array},'{dest}'::uuid];
          DELETE FROM public.document_code_sequences WHERE company_id='{c}'
          AND starts_with(code_prefix,'warehouse-location:{w}:{tag}'); COMMIT;""")
        assert sql(f"SELECT count(*) FROM public.warehouse_locations WHERE warehouse_id='{w}' AND path_ids && ARRAY[{root_array},'{dest}'::uuid]") == '0'
        print('Simultaneous-move fixtures and sequence allocations removed.')


if __name__ == '__main__':
    run()
    run_simultaneous_moves()
    run_simultaneous_moves(force_failure=True)
