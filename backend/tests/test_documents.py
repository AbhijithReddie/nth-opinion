"""Document uploads: real type detection, size and page limits, scanned PDFs (the digest LLM call is faked)."""

import io

import pytest
from docx import Document

import documents as docs

TEXT = "Data analyst with SQL dashboards and Python cleaning experience. " * 3


def pdf_bytes(pages: list[str]) -> bytes:
    """A tiny valid PDF with one line of text per page ("" = an image-only page, like a scan)."""
    objs: list = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for text in pages:
        stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode() if text else b""
        objs.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {len(objs)} 0 R /Resources << /Font << /F1 3 0 R >> >> >>")
        kids.append(len(objs))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>"
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + (obj if isinstance(obj, bytes) else obj.encode()) + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += f"trailer << /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return bytes(out)


def docx_bytes(paragraphs: list[str]) -> bytes:
    d = Document()
    for p in paragraphs:
        d.add_paragraph(p)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200


def test_detect_type_uses_content_not_name():
    assert docs.detect_type(pdf_bytes([TEXT])) == "pdf"
    assert docs.detect_type(docx_bytes([TEXT])) == "docx"
    assert docs.detect_type(TEXT.encode()) == "txt"
    with pytest.raises(docs.DocumentError) as err:
        docs.detect_type(PNG)
    assert err.value.code == "unsupported_type"


def upload(client, data: bytes, name: str, doc_type: str = "resume"):
    return client.post("/api/documents/extract", files={"file": (name, data)}, data={"doc_type": doc_type})


def test_image_named_pdf_is_rejected(client, fake_llm):
    r = upload(client, PNG, "resume.pdf")
    assert r.status_code == 415
    assert r.json()["code"] == "unsupported_type"
    assert fake_llm.prompts == []


def test_pdf_named_docx_is_read_as_pdf(client, fake_llm):
    r = upload(client, pdf_bytes([TEXT, TEXT]), "resume.docx")
    assert r.status_code == 200
    body = r.json()
    assert body["pages"] == 2 and "[Page 2]" in body["text"]


def test_pitch_deck_gets_slide_markers(client, fake_llm):
    r = upload(client, pdf_bytes([TEXT, TEXT]), "deck.pdf", "pitch_deck")
    assert "[Slide 2]" in r.json()["text"]


def test_docx_and_txt(client, fake_llm):
    assert upload(client, docx_bytes(["Experience", TEXT]), "cv.docx").status_code == 200
    assert upload(client, TEXT.encode(), "cv.txt").json()["digest"] == "Skills: SQL and Python."


def test_too_large(client, fake_llm):
    r = upload(client, b"a" * (docs.MAX_BYTES + 1), "big.txt")
    assert r.status_code == 413 and r.json()["code"] == "too_large"


def test_too_many_pages(client, fake_llm):
    r = upload(client, pdf_bytes([TEXT] * 5), "cv.pdf")  # resumes allow 4
    assert r.status_code == 422 and r.json()["code"] == "too_many_pages"


def test_scanned_pdf(client, fake_llm):
    r = upload(client, pdf_bytes(["", "", ""]), "scan.pdf")
    assert r.status_code == 422 and r.json()["code"] == "scanned_pdf"


def test_pasted_text_limits(client, fake_llm):
    assert client.post("/api/documents/digest", json={"doc_type": "notes", "text": "short"}).status_code == 422
    assert client.post("/api/documents/digest", json={"doc_type": "notes", "text": "x" * 12_001}).status_code == 422
    assert client.post("/api/documents/digest", json={"doc_type": "notes", "text": TEXT}).status_code == 200


def test_truncate_keeps_about_12000_characters():
    assert len(docs.truncate("word " * 10_000)) <= docs.MAX_TEXT + 10
