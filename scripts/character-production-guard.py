"""Offline pre-dispatch gate and atomic credit reservations. No provider calls.

This validates evidence records; it does not infer visual correctness from PNGs.
Direct MCP/UI generation can bypass it, so producers must reserve before submit
and record an unknown outcome instead of resubmitting a timed-out request.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
import uuid
from decimal import Decimal
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text('utf-8-sig'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(value, reason):
    if not value:
        raise ValueError(reason)


def evidence(ref):
    require(isinstance(ref, dict) and ref.get('path') and ref.get('sha256'), 'EVIDENCE_REQUIRED')
    p = Path(ref['path'])
    require(p.is_file() and sha(p) == ref['sha256'], 'EVIDENCE_HASH_DRIFT')
    return p


def known(value):
    if value is None or isinstance(value, str) and (not value.strip() or value.upper() in ('UNKNOWN', 'PENDING', 'UNCLASSIFIED')):
        return False
    if isinstance(value, dict):
        return bool(value) and all(known(v) for v in value.values())
    if isinstance(value, list):
        return all(known(v) for v in value)
    return True


def native_point(value):
    return isinstance(value, list) and len(value) == 2 and all(type(n) in (int, float) and math.isfinite(n) for n in value)


def fresh(timestamp, now, age):
    value = dt.datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    require(value.tzinfo is not None, 'TIMESTAMP_TIMEZONE_REQUIRED')
    require(0 <= (now - value).total_seconds() <= age, 'STALE_PROVIDER_QUOTE_OR_BALANCE')


def checked_method(policy):
    require(policy['methodStatus'] == 'PROVEN_REPRESENTATIVE_SET', 'METHOD_NOT_PROVEN')
    cert = read(evidence(policy['methodEvidence']))
    require(cert.get('status') == 'PASS_REPRESENTATIVE_NATIVE_AND_GAME_QA' and cert.get('methodId') == policy['methodId'], 'METHOD_EVIDENCE_REQUIRED')
    rows = cert.get('records', [])
    require(len({r['entityId'] for r in rows}) >= 6, 'SIX_DISTINCT_REPRESENTATIVES_REQUIRED')
    for row in rows:
        bank_path = evidence(row['bank'])
        visual = read(evidence(row['visualReview']))
        renderer = read(evidence(row['rendererReview']))
        require(visual.get('status') == 'PASS_NATIVE_POSE_SET' and visual.get('unresolved') == [] and len(visual.get('targets', [])) >= 4, 'VISUAL_EVIDENCE_NOT_PASSED')
        require(visual.get('reviewedBy') and visual.get('reviewedAt'), 'VISUAL_REVIEWER_REQUIRED')
        require(renderer.get('failures') == [] and renderer.get('complete') is True, 'RENDERER_EVIDENCE_NOT_PASSED')
        for proof in (visual, renderer):
            require(proof.get('entityId') == row['entityId'] and proof.get('sourceBankSha256') == sha(bank_path), 'METHOD_BANK_EVIDENCE_DRIFT')
        checks = row.get('checks', {})
        require(all(checks.get(k) is True for k in ('pose', 'expression', 'restraint', 'contact', 'identity', 'sequence', 'nativeAnd4x8x')), 'REPRESENTATIVE_CHECKS_INCOMPLETE')
    complete = read(evidence(cert.get('completeRepresentative')))
    require(complete.get('status') == 'PASS_COMPLETE_LOCAL_ART_AND_RAISING_QA' and complete.get('unresolved') == [] and complete.get('sequenceCount') == 53 and complete.get('normalGameSaveReload') is True, 'COMPLETE_REPRESENTATIVE_REQUIRED')
    require(any(r['entityId'] == complete.get('entityId') and r['bank']['sha256'] == complete.get('sourceBankSha256') for r in rows), 'COMPLETE_REPRESENTATIVE_BANK_DRIFT')


def check_request(policy, state, request, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    params = request['params']
    for key in ('model', 'variant', 'quality', 'resolution', 'count', 'background'):
        require(params.get(key) == policy[key], 'DISALLOWED_GENERATION_SETTING_' + key)
    require(request['methodId'] == policy['methodId'], 'METHOD_VERSION_DRIFT')
    bucket = request['bucket']
    require(bucket in policy['buckets'], 'UNKNOWN_BUDGET_BUCKET')
    calibration = bucket == 'calibration'
    if not calibration:
        checked_method(policy)
    quote = read(evidence(request['quote']))
    balance = read(evidence(request['balance']))
    for obj in (quote, balance):
        fresh(obj['capturedAt'], now, policy['maxQuoteAgeSeconds'])
    require(quote.get('source') == 'HIGGSFIELD_ESTIMATE_IMAGE_COST' and balance.get('source') == 'HIGGSFIELD_BALANCE', 'PROVIDER_RECEIPT_REQUIRED')
    require(quote['params'] == {k: params[k] for k in quote['params']} and all(k in quote['params'] for k in ('model', 'variant', 'quality', 'resolution', 'count', 'background')), 'QUOTE_SETTING_DRIFT')
    cost = Decimal(str(quote['credits']))
    require(0 < cost <= Decimal(policy['maximumQuotedImageCost']), 'COST_ABOVE_POLICY')
    jobdir = Path(request['jobDirectory'])
    job = read(jobdir / 'job.json')
    for field in ('inventory', 'motionContract', 'selectedConcept', 'review'):
        evidence(job[field])
    contract = read(evidence(request['poseContract']))
    require(contract.get('jobSha256') == sha(jobdir / 'job.json') and contract.get('entityId') == job['entityId'], 'POSE_JOB_DRIFT')
    require(contract.get('status') == 'PASS_SOURCE_POSE_CONTRACT' and contract.get('originalSeedReviewedBy') and contract.get('originalSeedReviewedAt'), 'REVIEWED_NATIVE_SEED_AND_POSE_CONTRACT_REQUIRED')
    evidence(contract.get('originalSeed'))
    evidence(contract.get('sourceEvidence'))
    inv = read(job['inventory']['path'])
    keys = request['patchKeys']
    require(len(keys) == len(set(keys)) and bool(keys), 'DUPLICATE_OR_EMPTY_KEYS')
    limit = policy['calibrationMaxTargetsPerImage'] if calibration else policy['productionMaxTargetsPerImage']
    require(len(keys) <= limit, 'TOO_MANY_TARGET_POSES')
    for key in keys:
        require(key in job['keys'] and key not in job.get('derived', {}) and key not in job.get('authoredMarkers', {}), 'DETERMINISTIC_OR_UNKNOWN_KEY_MUST_NOT_BE_PAID')
        require(inv['slots'][key]['canonical'] == key, 'ALIAS_MUST_NOT_BE_GENERATED')
        cell = contract.get('cells', {}).get(key, {})
        require(cell.get('route') == 'MODEL_REQUIRED' and cell.get('reviewedBy') and cell.get('reviewedAt'), 'CELL_TRIAGE_REQUIRED')
        constraints = cell.get('constraints', {})
        require(all(k in constraints for k in ('topology', 'facing', 'bodyAxis', 'expression', 'restraint', 'landmarks', 'contacts')) and all(known(v) for k, v in constraints.items() if k != 'contacts'), 'EXPLICIT_POSE_CONSTRAINTS_REQUIRED')
        require(native_point(constraints['bodyAxis']) and any(constraints['bodyAxis']), 'BODY_AXIS_VECTOR_REQUIRED')
        points = constraints['landmarks']
        require(isinstance(points, dict) and bool(points) and all(native_point(v) for v in points.values()), 'ANATOMICAL_LANDMARK_COORDINATES_REQUIRED')
        contacts = constraints['contacts']
        require(isinstance(contacts, dict) and all(native_point(v) for v in contacts.values()), 'CONTACT_COORDINATES_REQUIRED')
        require(bool(contacts) or constraints.get('contactState') in ('airborne', 'floating', 'no_visible_contact'), 'EMPTY_CONTACTS_REQUIRE_SOURCE_EXPLANATION')
        require(cell.get('canvasOrigin') == inv['slots'][key].get('canvasOrigin', job['sourceOrigin']), 'ORIGIN_DRIFT')
    identity = {k: request[k] for k in ('methodId', 'jobDirectory', 'poseContract', 'patchKeys', 'params')}
    fingerprint = hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    records = state['reservations']
    require(not any(r['fingerprint'] == fingerprint and r['status'] != 'cancelled_before_submit' for r in records), 'DUPLICATE_REQUEST_COLLECT_EXISTING_JOB')
    for key in keys:
        attempts = sum(r['entityId'] == job['entityId'] and r['methodId'] == request['methodId'] and key in r['keys'] and r['status'] != 'cancelled_before_submit' for r in records)
        require(attempts < policy['maxAttemptsPerCanonicalPerMethod'], 'POSE_RETRY_LIMIT_USE_NATIVE_REPAIR')
    active = [r for r in records if r['status'] in ('reserved', 'submitted', 'unknown')]
    require(len(active) < (1 if calibration and policy['methodStatus'] != 'PROVEN_REPRESENTATIVE_SET' else policy['maxInFlight']), 'IN_FLIGHT_LIMIT')
    counted = [r for r in records if r['status'] != 'cancelled_before_submit']
    committed = lambda rows: sum((Decimal(r['reservedCredits']) for r in rows), Decimal(0))
    require(committed([r for r in counted if r['bucket'] == bucket]) + cost <= Decimal(policy['buckets'][bucket]), 'BUCKET_EXHAUSTED_OTHER_STAGES_PROTECTED')
    require(committed(counted) + cost <= Decimal(policy['initialCredits']), 'TOTAL_BUDGET_EXHAUSTED')
    # Conservative: hold all in-flight reservations even if provider balance
    # already reflects some of them. Never assume an unknown submission is free.
    require(committed(active) + cost <= Decimal(str(balance['credits'])), 'LIVE_BALANCE_INSUFFICIENT')
    return {'fingerprint': fingerprint, 'entityId': job['entityId'], 'keys': keys,
            'methodId': request['methodId'], 'bucket': bucket,
            'reservedCredits': str(cost), 'status': 'reserved', 'jobId': None,
            'createdAt': now.isoformat(), 'poseContract': request['poseContract']}


def mutate(policy_path, state_path, action):
    state_path = Path(state_path)
    lock = state_path.with_suffix(state_path.suffix + '.lock')
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise ValueError('BUDGET_BUSY_VERIFY_PRIOR_PROCESS_DO_NOT_REMOVE_BLINDLY')
    temp = state_path.with_name(state_path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        os.close(fd)
        policy = read(policy_path); state = read(state_path)
        require(state['policySha256'] == sha(policy_path), 'POLICY_DRIFT_RECONCILE_RESERVATIONS')
        result = action(policy, state)
        temp.write_text(json.dumps(state, ensure_ascii=False, indent=2), 'utf-8')
        os.replace(temp, state_path)
        return result
    finally:
        if temp.exists():
            temp.unlink()
        lock.unlink()


def reserve(policy_path, state_path, request_path):
    request = read(request_path)
    def action(policy, state):
        row = check_request(policy, state, request)
        row['requestPath'] = str(Path(request_path).resolve())
        row['requestSha256'] = sha(request_path)
        state['reservations'].append(row)
        return row
    return mutate(policy_path, state_path, action)


def record_result(policy_path, state_path, fingerprint, status, proof_ref):
    proof_path = evidence(proof_ref)
    proof = read(proof_path)
    allowed = {'reserved': {'submitted', 'unknown', 'cancelled_before_submit'},
               'submitted': {'completed', 'failed', 'unknown'},
               'unknown': {'submitted', 'completed', 'failed'}}
    def action(policy, state):
        row = next(r for r in state['reservations'] if r['fingerprint'] == fingerprint)
        require(status in allowed.get(row['status'], set()), 'INVALID_RESULT_TRANSITION')
        require(proof.get('fingerprint') == fingerprint and proof.get('status') == status, 'RESULT_RECEIPT_MISMATCH')
        if status == 'cancelled_before_submit':
            require(proof.get('providerInvoked') is False, 'UNKNOWN_SUBMISSION_CANNOT_RELEASE_FUNDS')
        elif status != 'unknown':
            require(proof.get('jobId'), 'PROVIDER_JOB_ID_REQUIRED')
            require(not row['jobId'] or row['jobId'] == proof['jobId'], 'JOB_ID_DRIFT')
            require(not any(r is not row and r.get('jobId') == proof['jobId'] for r in state['reservations']), 'PROVIDER_JOB_REUSED')
            row['jobId'] = proof['jobId']
        row.update({'status': status, 'resultEvidence': proof_ref})
        # Completed/failed charges remain reserved until explicit reconciliation.
        return row
    return mutate(policy_path, state_path, action)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=('check', 'reserve', 'record'))
    p.add_argument('--policy', type=Path, required=True)
    p.add_argument('--state', type=Path, required=True)
    p.add_argument('--request', type=Path)
    p.add_argument('--fingerprint')
    p.add_argument('--status', choices=('submitted', 'unknown', 'completed', 'failed', 'cancelled_before_submit'))
    p.add_argument('--proof', type=Path)
    a = p.parse_args()
    if a.action == 'check':
        state = read(a.state)
        require(state['policySha256'] == sha(a.policy), 'POLICY_DRIFT')
        result = check_request(read(a.policy), state, read(a.request))
    elif a.action == 'reserve':
        result = reserve(a.policy, a.state, a.request)
    else:
        result = record_result(a.policy, a.state, a.fingerprint, a.status, {'path': str(a.proof), 'sha256': sha(a.proof)})
    print(json.dumps(result, ensure_ascii=False))
