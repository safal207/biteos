//! Offline BiteOS claim ingestion into a dedicated native LiminalDB WAL.
//! Storage acknowledgement is not observation or authorization of external effects.
use anyhow::{bail, ensure, Context, Result};
use liminal_store::{sha256_ref, Offset, Store};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashSet, env, io::{self, Read}, path::Path};

const BATCH: &str = "biteos.evidence.batch.v1";
const RECEIPT: &str = "biteos.evidence.receipt.v1";
const LIMIT: u64 = 32 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Item {
    event: Value,
    canonical: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Batch {
    schema: String,
    stream: String,
    events: Vec<Item>,
}
#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    schema: String,
    stream: String,
    item: Item,
}
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v[key].as_str().with_context(|| format!("invalid {key}"))
}
fn validate(b: &Batch) -> Result<()> {
    ensure!(b.schema == BATCH, "wrong batch schema");
    ensure!(!b.stream.is_empty() && b.stream.len() <= 64 && b.stream.bytes().all(|x| x.is_ascii_alphanumeric() || x == b'-' || x == b'_'), "invalid stream");
    ensure!(b.events.len() <= 6000, "batch too large");
    let mut previous = "";
    let mut ids = HashSet::new();
    for (i, item) in b.events.iter().enumerate() {
        let v = &item.event;
        let fields = v.as_object().context("event must be an object")?;
        ensure!(fields.len() == 10 && ["version","eventId","actionId","kind","sequence","aggregateVersion","status","capturedAt","previousDigest","digest"].iter().all(|k| fields.contains_key(*k)), "invalid fields");
        ensure!(v["version"] == 1 && v["sequence"].as_u64() == Some(i as u64 + 1), "sequence mismatch");
        ensure!(matches!(v["aggregateVersion"].as_u64(), Some(1..=6)), "invalid aggregate version");
        let action = text(v,"actionId")?;
        let kind = text(v,"kind")?;
        let status = text(v,"status")?;
        let id = text(v,"eventId")?;
        ensure!(action.len() <= 64 && !action.is_empty() && action.bytes().all(|x| x.is_ascii_alphanumeric() || x == b'-'),"invalid action");
        ensure!((kind == "order" && matches!(status,"reserved"|"picking"|"packed"|"in_transit"|"delivered"|"collected"|"cancelled")) || (kind == "inventory" && status == "received"),"unsupported event");
        ensure!(id == format!("{action}:{kind}:{status}") && ids.insert(id),"duplicate/invalid event ID");
        ensure!(!text(v,"capturedAt")?.is_empty(),"missing timestamp");
        ensure!(text(v,"previousDigest")? == previous,"chain discontinuity");
        let digest = text(v,"digest")?;
        let mut expected = v.clone();
        expected["digest"] = json!("");
        ensure!(serde_json::from_str::<Value>(&item.canonical)? == expected && sha256_ref(item.canonical.as_bytes()) == digest,"digest mismatch");
        previous = digest;
    }
    Ok(())
}
fn ingest(root: &Path, b: &Batch) -> Result<Value> {
    validate(b)?;
    // Dedicated directory per store/stream. Never mix native runtime formats.
    let mut wal = Store::open(root.join("biteos-claims-v1").join(&b.stream))?;
    let mut replayed = 0usize;
    for record in wal.stream_from(Offset::start())? {
        let record: Record = serde_json::from_slice(&record?)?;
        let expected = b.events.get(replayed).context("source rollback/truncated batch")?;
        ensure!(record.schema == "biteos.evidence.record.v1" && record.stream == b.stream && &record.item == expected,"stored prefix conflicts with source");
        replayed += 1;
    }
    // All input and stored prefix are validated before the first append.
    // If a later append fails, retry checks the actual durable prefix.
    for item in &b.events[replayed..] {
        let record = Record { schema:"biteos.evidence.record.v1".into(), stream:b.stream.clone(), item:item.clone() };
        wal.append(&serde_json::to_vec(&record)?)?;
    }
    Ok(json!({
        "schema": RECEIPT, "stream": b.stream, "count": b.events.len(),
        "head": b.events.last().map(|i| i.event["digest"].as_str().unwrap()).unwrap_or(""),
        "inserted": b.events.len()-replayed, "replayed": replayed,
        "externalEffectsAuthorized": false
    }))
}
fn main() -> Result<()> {
    let mut args = env::args_os().skip(1);
    let root = args.next().context("ledger root required")?;
    if args.next().is_some() { bail!("unexpected argument"); }
    let mut buf = Vec::new();
    io::stdin().take(LIMIT+1).read_to_end(&mut buf)?;
    ensure!(buf.len() as u64 <= LIMIT,"input too large");
    let batch: Batch = serde_json::from_slice(&buf)?;
    println!("{}", ingest(Path::new(&root), &batch)?);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn batch() -> Batch {
        let mut event=json!({"version":1,"eventId":"retail-1:order:reserved","actionId":"retail-1","kind":"order","sequence":1,"aggregateVersion":1,"status":"reserved","capturedAt":"2026-01-01T00:00:00Z","previousDigest":"","digest":""});
        let canonical=event.to_string();
        event["digest"]=json!(sha256_ref(canonical.as_bytes()));
        Batch{schema:BATCH.into(),stream:"demo".into(),events:vec![Item{event,canonical}]}
    }
    #[test]
    fn reopen_retry_conflict_and_truncation() {
        let dir=tempfile::tempdir().unwrap();
        let b=batch();
        assert_eq!(ingest(dir.path(),&b).unwrap()["inserted"],1);
        assert_eq!(ingest(dir.path(),&b).unwrap()["replayed"],1);
        let mut damaged=b.clone();
        damaged.events[0].event["status"]=json!("cancelled");
        assert!(ingest(dir.path(),&damaged).is_err());
        let mut conflicting=b.clone();
        conflicting.events[0].event["capturedAt"]=json!("2026-01-02T00:00:00Z");
        conflicting.events[0].event["digest"]=json!("");
        conflicting.events[0].canonical=conflicting.events[0].event.to_string();
        conflicting.events[0].event["digest"]=json!(sha256_ref(conflicting.events[0].canonical.as_bytes()));
        assert!(ingest(dir.path(),&conflicting).is_err());
        let mut truncated=b.clone();
        truncated.events.clear();
        assert!(ingest(dir.path(),&truncated).is_err());
        assert_eq!(ingest(dir.path(),&b).unwrap()["replayed"],1);
    }
}
