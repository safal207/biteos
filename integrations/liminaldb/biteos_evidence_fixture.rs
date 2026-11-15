//! Native LiminalDB compatibility proof, copied into the pinned upstream test crate.
//! An accepted BiteOS reservation is an internal claim, not external payment evidence.
use liminal_store::{
    sha256_ref, AuthorityState, CausalValidityState, ContinuityPosture, ExecutionState,
    ResponseIntegrityState, TransitionDimensions, TransitionEventInput, TransitionLinks,
    TransitionRecordKind, TrustworthyTransitionLedger,
};
use serde_json::Value;
use std::{env, fs};
use tempfile::tempdir;

#[test]
fn biteos_claim_with_unavailable_external_readback_requires_revalidation_after_reopen() {
    let path = env::var("BITEOS_EVIDENCE_FIXTURE").expect("Go-generated fixture path");
    let fixture: Value = serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
    let claim = &fixture["claim"];
    let digest = claim["digest"].as_str().unwrap();
    let canonical = fixture["canonical"].as_str().unwrap();
    let mut expected = claim.clone();
    expected["digest"] = Value::String(String::new());
    assert_eq!(serde_json::from_str::<Value>(canonical).unwrap(), expected);
    assert_eq!(sha256_ref(canonical.as_bytes()), digest);
    assert_eq!(claim["kind"], "order");
    assert_eq!(claim["status"], "reserved");
    assert_eq!(fixture["readback"], "UNAVAILABLE");
    let action = claim["actionId"].as_str().unwrap();
    let transition = format!("biteos-fixture:{action}");
    let make_record = |kind, label: &str, links| TransitionEventInput {
        transition_id: transition.clone(),
        subject_id: "biteos:synthetic-demo".to_owned(),
        kind,
        record_ref: sha256_ref(format!("{digest}:{label}:record").as_bytes()),
        payload_digest: sha256_ref(format!("{digest}:{label}:payload").as_bytes()),
        links,
        dimensions: None,
        side_effect_committed: None,
        captured_at_ms: 1,
    };
    let dims = TransitionDimensions {
        authority: AuthorityState::Valid, // fixture admission only, no real payment permission
        execution: ExecutionState::NotObserved,
        response_integrity: ResponseIntegrityState::Unknown,
        causal_validity: CausalValidityState::NotEvaluated,
        continuity_posture: ContinuityPosture::Revalidate,
    };
    let root = tempdir().unwrap();
    let before = {
        let mut ledger = TrustworthyTransitionLedger::open(root.path()).unwrap();
        let auth = ledger.append(make_record(TransitionRecordKind::Authorization, "fixture-auth", TransitionLinks::default())).unwrap();
        let auth_ref = auth.body.record_ref.clone();
        let mut obs = make_record(TransitionRecordKind::Observation, "readback-unavailable", TransitionLinks { authorization_ref: Some(auth_ref.clone()), ..TransitionLinks::default() });
        obs.dimensions = Some(TransitionDimensions {
            response_integrity: ResponseIntegrityState::NotEvaluated,
            continuity_posture: ContinuityPosture::NotEvaluated,
            ..dims.clone()
        });
        let obs = ledger.append(obs).unwrap();
        let obs_refs = vec![obs.body.record_ref];
        let mut response = make_record(TransitionRecordKind::ResponseIntegrity, "unknown-response", TransitionLinks { authorization_ref: Some(auth_ref.clone()), observation_refs: obs_refs.clone(), ..TransitionLinks::default() });
        response.dimensions = Some(TransitionDimensions { continuity_posture: ContinuityPosture::NotEvaluated, ..dims.clone() });
        let response = ledger.append(response).unwrap();
        let response_ref = response.body.record_ref;
        let mut causal = make_record(TransitionRecordKind::CausalAudit, "not-evaluated-causal", TransitionLinks { authorization_ref: Some(auth_ref.clone()), observation_refs: obs_refs.clone(), response_integrity_ref: Some(response_ref.clone()), ..TransitionLinks::default() });
        causal.dimensions = Some(TransitionDimensions { continuity_posture: ContinuityPosture::NotEvaluated, ..dims.clone() });
        let causal = ledger.append(causal).unwrap();
        let mut continuity = make_record(TransitionRecordKind::ContinuitySnapshot, "revalidate", TransitionLinks {
            authorization_ref: Some(auth_ref),
            observation_refs: obs_refs,
            response_integrity_ref: Some(response_ref),
            causal_audit_ref: Some(causal.body.record_ref),
            previous_continuity_ref: None,
        });
        continuity.dimensions = Some(dims.clone());
        ledger.append(continuity).unwrap();
        ledger.write_snapshot(2).unwrap();
        ledger.projection(&transition).cloned().unwrap()
    };
    let reopened = TrustworthyTransitionLedger::open(root.path()).unwrap();
    let after = reopened.projection(&transition).unwrap();
    assert_eq!(after, &before);
    assert_eq!(after.dimensions.as_ref(), Some(&dims));
    assert!(!after.side_effect_committed);
    println!("BITEOS-LIMINALDB-001: claim + unavailable readback -> REVALIDATE; replay equal");
}
