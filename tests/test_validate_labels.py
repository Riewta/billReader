from collections import Counter

from slipsense_ml.eval.dataset import load_labels
from slipsense_ml.eval.validate_labels import assign_splits, read_records, validate

GOOD = {
    "id": "kbank_001", "file": "kbank_001.jpg", "bank": "kbank", "amount": "150.00",
    "paid_at": "2025-11-03T12:34", "receiver_name": "นาย สมชาย ใจดี", "ref": "015307123456ABC12345",
    "kind": "transfer", "cloud_ok": True, "split": "dev",
}


def _v(*rows, images_dir=None):
    return validate([(i, r) for i, r in enumerate(rows, 1)], images_dir)


def test_good_record_has_no_issues():
    iss = _v(GOOD)
    assert iss.errors == [] and iss.warnings == []


def test_buddhist_year_is_caught_with_hint():
    iss = _v({**GOOD, "paid_at": "2568-11-03T12:34"})
    assert any("พ.ศ." in e and "2025" in e for e in iss.errors)


def test_amount_must_be_string_with_two_decimals():
    assert _v({**GOOD, "amount": 150.0}).errors
    assert _v({**GOOD, "amount": "1,250.00"}).errors
    assert _v({**GOOD, "amount": "150"}).errors


def test_typo_key_warns():
    row = {k: v for k, v in GOOD.items() if k != "amount"} | {"ammount": "150.00"}
    assert any("ammount" in w for w in _v(row).warnings)


def test_duplicate_id_and_bad_bank():
    iss = _v(GOOD, {**GOOD, "file": "other.jpg", "bank": "kasikorn"})
    assert any("ซ้ำ" in e for e in iss.errors)
    assert any("kasikorn" in e for e in iss.errors)


def test_ref_with_space_rejected():
    assert _v({**GOOD, "ref": "0153 0712 3456"}).errors


def test_broken_json_reported_with_line(tmp_path):
    p = tmp_path / "labels.jsonl"
    p.write_text('{"id": "a"\n', encoding="utf-8")
    iss = validate(read_records(p))
    assert iss.errors and iss.errors[0].startswith("บรรทัด 1")


def test_missing_and_unlabeled_images(tmp_path):
    (tmp_path / "extra.jpg").write_bytes(b"")
    iss = _v(GOOD, images_dir=tmp_path)
    assert any("ไม่พบรูป" in e for e in iss.errors)
    assert any("extra.jpg" in w for w in iss.warnings)


def test_assign_splits_stratified_and_stable():
    rows = [{"id": f"{b}_{i:03}", "bank": b} for b in ("kbank", "scb") for i in range(30)]
    assert assign_splits(rows) == 60
    c = Counter((r["bank"], r["split"]) for r in rows)
    assert c[("kbank", "test")] == 10 and c[("scb", "test")] == 10

    again = [{"id": r["id"], "bank": r["bank"]} for r in rows]
    assign_splits(again)
    assert [r["split"] for r in again] == [r["split"] for r in rows]  # รันซ้ำได้ผลเดิม


def test_assign_splits_never_touches_existing():
    rows = [{"id": f"k{i}", "bank": "kbank", "split": "test"} for i in range(5)]
    rows += [{"id": f"n{i}", "bank": "kbank"} for i in range(4)]
    assign_splits(rows)
    assert all(r["split"] == "test" for r in rows[:5])
    assert all(r["split"] == "dev" for r in rows[5:])  # test เกินโควตาแล้ว ใบใหม่เป็น dev หมด


def test_load_labels_filters_split():
    path = "data/labels.example.jsonl"
    assert [s.id for s in load_labels(path, split="dev")] == ["kbank_001"]
    assert [s.id for s in load_labels(path, split="test")] == ["scb_001"]
    assert len(load_labels(path)) == 2
